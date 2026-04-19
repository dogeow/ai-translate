import {
  DEFAULT_GITHUB_MODELS_API_URL,
  DEFAULT_GITHUB_MODEL,
  GITHUB_MODEL_WHITELIST,
} from "./constants.js";
import {
  createAiRequestLog,
  logAiRequestError,
  logAiRequestSuccess,
} from "./ai-request-log.js";
import {
  buildHttpErrorMessage,
  flattenTextContent,
  normalizeApiBaseUrl,
  parseSseLine,
  processStreamResponse,
} from "./utils/apiUtils.js";

export const GITHUB_API_VERSION = "2026-03-10";
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const DEVICE_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_MODELS_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const GITHUB_MODELS_MAX_OUTPUT_TOKENS = 1200;
const GITHUB_STABLE_FALLBACK_MODEL = "openai/gpt-4.1";
const githubModelsCatalogCache = new Map();

export function normalizeGitHubModelsBaseUrl(base) {
  return normalizeApiBaseUrl(base, DEFAULT_GITHUB_MODELS_API_URL);
}

function buildGitHubModelsErrorMessage(status, responseText, retryAfter = "") {
  const lower = String(responseText || "").toLowerCase();

  if (
    (status === 403 || status === 404) &&
    /no[_ ]access|not authorized|forbidden/.test(lower)
  ) {
    return `当前 GitHub 登录令牌无权访问该模型（HTTP ${status}）。请重新执行设备登录，或切换到其他可用模型。`;
  }

  if (status === 429) {
    const waitSeconds = Number.parseInt(String(retryAfter || "").trim(), 10);
    const waitHint = Number.isFinite(waitSeconds) && waitSeconds > 0
      ? `请在 ${waitSeconds} 秒后重试`
      : "请稍后再试";
    return `GitHub Models 当前触发了速率限制（HTTP 429）。${waitHint}；这是账号级共享额度，gpt-4.1 和 gpt-4o 也会共同受限。`;
  }

  if (status >= 500) {
    return `GitHub Models 服务暂时不可用（HTTP ${status}）。请稍后再试，或切换到其他可用模型。`;
  }

  return buildHttpErrorMessage(status, "GitHub Models", responseText);
}

function shouldRetryGitHubModelsRequest(status, responseText = "") {
  const lower = String(responseText || "").toLowerCase();
  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /temporarily unavailable|server error|timed out/.test(lower)
  );
}

function shouldFallbackGitHubModel(model, status, responseText = "") {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const lower = String(responseText || "").toLowerCase();
  // 403/404 + "no access"/"no_access" 表示当前令牌无权访问该模型（如 PAT 不支持 gpt-5 系列）
  const noAccess =
    (status === 403 || status === 404) &&
    /no[_ ]access|not authorized|forbidden/.test(lower);
  return (
    normalizedModel.startsWith("openai/gpt-5") &&
    (status >= 500 ||
      noAccess ||
      /unavailable model|not available|unsupported/.test(lower))
  );
}

function createGitHubModelsHttpError(status, responseText, retryAfter = "") {
  const error = new Error(
    buildGitHubModelsErrorMessage(status, responseText, retryAfter),
  );
  error.status = status;
  error.responseText = responseText;
  error.retryAfter = retryAfter;
  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenMaybeText(value) {
  return flattenTextContent(value, [
    "text",
    "output_text",
    "content",
    "reasoning_content",
    "reasoning",
  ]);
}

function extractChoiceResponseText(choice) {
  return (
    flattenMaybeText(choice?.delta?.content) ||
    flattenMaybeText(choice?.message?.content) ||
    flattenMaybeText(choice?.content) ||
    flattenMaybeText(choice?.text)
  );
}

function extractChoiceThinkingText(choice) {
  return (
    flattenMaybeText(choice?.delta?.reasoning_content) ||
    flattenMaybeText(choice?.delta?.reasoning) ||
    flattenMaybeText(choice?.message?.reasoning_content) ||
    flattenMaybeText(choice?.message?.reasoning) ||
    flattenMaybeText(choice?.reasoning_content) ||
    flattenMaybeText(choice?.reasoning)
  );
}

function parseChoicePayload(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  if (choices.length === 0) return { response: "", thinking: "" };

  let response = "";
  let thinking = "";
  choices.forEach((choice) => {
    response += extractChoiceResponseText(choice);
    thinking += extractChoiceThinkingText(choice);
  });

  return { response, thinking };
}

function getGitHubModelsHeaders(token) {
  const bearer = String(token || "").trim();
  if (!bearer) {
    throw new Error("请先填写 GitHub 访问令牌。");
  }

  return {
    Authorization: `Bearer ${bearer}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

function isGpt5SeriesModel(model) {
  return String(model || "").trim().toLowerCase().startsWith("openai/gpt-5");
}

function buildGitHubModelsRequestBody(body) {
  const model =
    String(body?.model || DEFAULT_GITHUB_MODEL).trim() || DEFAULT_GITHUB_MODEL;
  const tokenLimit = Math.max(
    1,
    Number(body?.max_tokens || body?.max_completion_tokens) ||
      GITHUB_MODELS_MAX_OUTPUT_TOKENS,
  );

  const next = { ...body, model };
  delete next.max_tokens;
  delete next.max_completion_tokens;

  if (isGpt5SeriesModel(model)) {
    // GPT-5 系列只接受 max_completion_tokens，且仅支持默认 temperature/top_p
    next.max_completion_tokens = tokenLimit;
    delete next.temperature;
    delete next.top_p;
  } else {
    next.max_tokens = tokenLimit;
  }

  return next;
}

async function sendGitHubModelsChatRequest(base, token, body) {
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const requestBody = buildGitHubModelsRequestBody(body);

  async function sendOnce(nextBody) {
    const response = await fetch(`${normalizedBase}/inference/chat/completions`, {
      method: "POST",
      headers: getGitHubModelsHeaders(token),
      body: JSON.stringify(nextBody),
    });

    if (response.ok) {
      return {
        response,
        resolvedModel: nextBody.model,
      };
    }

    const text = await response.text();
    throw createGitHubModelsHttpError(
      response.status,
      text,
      response.headers.get("retry-after"),
    );
  }

  // GPT-5 系列免费额度极低（每分钟 2 次），且 5xx 频繁；不重试，直接落到 fallback，避免烧额度
  const isUnstableGpt5 = isGpt5SeriesModel(requestBody.model);
  const maxAttempts = isUnstableGpt5 ? 1 : 2;
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await sendOnce(requestBody);
    } catch (error) {
      lastError = error;
      if (!shouldRetryGitHubModelsRequest(error?.status, error?.responseText)) {
        break;
      }
      if (attempt < maxAttempts - 1) {
        await delay(700 * (attempt + 1));
      }
    }
  }

  if (
    shouldFallbackGitHubModel(
      requestBody.model,
      lastError?.status,
      lastError?.responseText,
    ) &&
    requestBody.model !== GITHUB_STABLE_FALLBACK_MODEL
  ) {
    try {
      return await sendOnce(
        buildGitHubModelsRequestBody({
          ...requestBody,
          model: GITHUB_STABLE_FALLBACK_MODEL,
        }),
      );
    } catch (fallbackError) {
      // fallback 自身失败时，保留更具诊断意义的原错误（gpt-5 的 5xx），但附加提示
      if (fallbackError?.status === 429) {
        throw fallbackError;
      }
      throw lastError || fallbackError;
    }
  }

  throw lastError || new Error("GitHub Models 请求失败");
}

async function requestGitHubModelsChatCompletion(base, token, body) {
  const { response, resolvedModel } = await sendGitHubModelsChatRequest(
    base,
    token,
    body,
  );
  const payload = await response.json();
  return {
    payload,
    status: response.status,
    resolvedModel,
  };
}

export async function generateGitHubModelsCompletion(base, token, model, prompt) {
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const requestBody = {
    model: model || DEFAULT_GITHUB_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: GITHUB_MODELS_MAX_OUTPUT_TOKENS,
    stream: false,
  };
  const trace = createAiRequestLog({
    provider: "github-models",
    endpoint: `${normalizedBase}/inference/chat/completions`,
    model: requestBody.model,
    stream: false,
    requestContent: prompt,
    requestPayload: requestBody,
  });
  let status = null;
  let hasLogged = false;

  try {
    const { payload, status: requestStatus, resolvedModel } =
      await requestGitHubModelsChatCompletion(
        normalizedBase,
        token,
        requestBody,
      );
    status = requestStatus;
    const { response, thinking } = parseChoicePayload(payload);
    const text = String(response || "").trim();
    if (!text) {
      throw new Error("GitHub Models 未返回可用内容。");
    }
    logAiRequestSuccess(trace, {
      status,
      responseContent: text,
      extra: {
        thinkingContent: String(thinking || "").trim() || null,
        resolvedModel:
          resolvedModel && resolvedModel !== requestBody.model
            ? resolvedModel
            : null,
      },
    });
    hasLogged = true;
    return text;
  } catch (error) {
    if (!hasLogged) {
      logAiRequestError(trace, error, { status });
    }
    throw error;
  }
}

export async function generateGitHubModelsStreamingCompletion(
  base,
  token,
  model,
  prompt,
  options = {},
) {
  const { onChunk } = options;
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const requestBody = {
    model: model || DEFAULT_GITHUB_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: GITHUB_MODELS_MAX_OUTPUT_TOKENS,
    stream: true,
  };
  const trace = createAiRequestLog({
    provider: "github-models",
    endpoint: `${normalizedBase}/inference/chat/completions`,
    model: requestBody.model,
    stream: true,
    requestContent: prompt,
    requestPayload: requestBody,
  });
  let status = null;
  let hasLogged = false;
  let chunkCount = 0;
  let responseText = "";
  let thinkingText = "";

  try {
    const { response, resolvedModel } = await sendGitHubModelsChatRequest(
      normalizedBase,
      token,
      requestBody,
    );
    status = response.status;

    await processStreamResponse(response, async (line) => {
      const parsed = parseSseLine(line);
      if (!parsed || parsed.done || !parsed.data) return;
      const chunk = parseChoicePayload(parsed.data);
      if (!chunk.response && !chunk.thinking) return;
      chunkCount += 1;
      responseText += chunk.response || "";
      thinkingText += chunk.thinking || "";
      onChunk?.(chunk);
    });

    const finalResponse = String(responseText || "").trim();
    const finalThinking = String(thinkingText || "").trim();
    if (!finalResponse) {
      throw new Error("GitHub Models 未返回可用内容。");
    }
    logAiRequestSuccess(trace, {
      status,
      responseContent: finalResponse,
      extra: {
        thinkingContent: finalThinking || null,
        chunkCount,
        resolvedModel:
          resolvedModel && resolvedModel !== requestBody.model
            ? resolvedModel
            : null,
      },
    });
    hasLogged = true;
    return {
      response: finalResponse,
      thinking: finalThinking,
    };
  } catch (error) {
    if (!hasLogged) {
      logAiRequestError(trace, error, { status, extra: { chunkCount } });
    }
    throw error;
  }
}

export async function fetchGitHubModels(base, token, options = {}) {
  const { forceRefresh = false } = options;
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const cached = githubModelsCatalogCache.get(normalizedBase);
  const now = Date.now();

  if (
    !forceRefresh &&
    cached &&
    now - cached.updatedAt < GITHUB_MODELS_CATALOG_CACHE_TTL_MS
  ) {
    return [...cached.models];
  }

  const response = await fetch(`${normalizedBase}/catalog/models`, {
    method: "GET",
    headers: getGitHubModelsHeaders(token),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      buildGitHubModelsErrorMessage(
        response.status,
        text,
        response.headers.get("retry-after"),
      ),
    );
  }

  // 仅向用户暴露白名单中的稳定模型；忽略远端返回的其他 ID（包括 gpt-5 系列预览版）
  // 即使本次目录请求成功，我们也只展示白名单，保证用户可选项一致
  await response.json().catch(() => null);
  const models = [...GITHUB_MODEL_WHITELIST];

  githubModelsCatalogCache.set(normalizedBase, {
    models: [...models],
    updatedAt: now,
  });

  return [...models];
}

export async function testGitHubModelsConnection(base, token) {
  const models = await fetchGitHubModels(base, token, { forceRefresh: true });
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("GitHub Models 未返回可用模型。");
  }
  return "ok";
}

export async function requestGitHubDeviceCode(clientId) {
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedClientId) {
    throw new Error("请先填写 GitHub OAuth App Client ID。");
  }

  const response = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ client_id: normalizedClientId }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      String(payload?.error_description || payload?.error || "GitHub 设备登录初始化失败。"),
    );
  }
  return payload;
}

export async function pollGitHubDeviceToken({
  clientId,
  deviceCode,
  interval = 5,
}) {
  const normalizedClientId = String(clientId || "").trim();
  const normalizedDeviceCode = String(deviceCode || "").trim();
  if (!normalizedClientId || !normalizedDeviceCode) {
    throw new Error("设备登录参数不完整。");
  }

  let currentInterval = Math.max(1, Number(interval) || 5);

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, currentInterval * 1000));

    const response = await fetch(DEVICE_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: normalizedClientId,
        device_code: normalizedDeviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const payload = await response.json();
    if (payload?.access_token) {
      return payload.access_token;
    }
    if (payload?.error === "authorization_pending") {
      continue;
    }
    if (payload?.error === "slow_down") {
      currentInterval = Number(payload?.interval) || currentInterval + 5;
      continue;
    }

    throw new Error(
      String(payload?.error_description || payload?.error || "GitHub 设备登录失败。"),
    );
  }
}
