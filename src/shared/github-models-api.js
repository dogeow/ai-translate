import {
  DEFAULT_GITHUB_MODELS_API_URL,
  DEFAULT_GITHUB_MODEL,
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

export function normalizeGitHubModelsBaseUrl(base) {
  return normalizeApiBaseUrl(base, DEFAULT_GITHUB_MODELS_API_URL);
}

function buildGitHubModelsErrorMessage(status, responseText) {
  return buildHttpErrorMessage(status, "GitHub Models", responseText);
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

async function requestGitHubModelsChatCompletion(base, token, body) {
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const response = await fetch(`${normalizedBase}/inference/chat/completions`, {
    method: "POST",
    headers: getGitHubModelsHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildGitHubModelsErrorMessage(response.status, text));
  }

  const payload = await response.json();
  return {
    payload,
    status: response.status,
  };
}

export async function generateGitHubModelsCompletion(base, token, model, prompt) {
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const requestBody = {
    model: model || DEFAULT_GITHUB_MODEL,
    messages: [{ role: "user", content: prompt }],
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
    const { payload, status: requestStatus } =
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
    const response = await fetch(`${normalizedBase}/inference/chat/completions`, {
      method: "POST",
      headers: getGitHubModelsHeaders(token),
      body: JSON.stringify(requestBody),
    });
    status = response.status;

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(buildGitHubModelsErrorMessage(response.status, text));
      logAiRequestError(trace, error, {
        status,
        extra: {
          errorBody: text || null,
          chunkCount,
        },
      });
      hasLogged = true;
      throw error;
    }

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

export async function fetchGitHubModels(base, token) {
  const normalizedBase = normalizeGitHubModelsBaseUrl(base);
  const response = await fetch(`${normalizedBase}/catalog/models`, {
    method: "GET",
    headers: getGitHubModelsHeaders(token),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildGitHubModelsErrorMessage(response.status, text));
  }

  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : [];
  const ids = list
    .map((item) => String(item?.id || "").trim())
    .filter(Boolean);
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) {
    return [DEFAULT_GITHUB_MODEL];
  }
  if (!unique.includes(DEFAULT_GITHUB_MODEL)) {
    unique.unshift(DEFAULT_GITHUB_MODEL);
  }
  return unique;
}

export async function testGitHubModelsConnection(base, token, model) {
  return generateGitHubModelsCompletion(
    base,
    token,
    model || DEFAULT_GITHUB_MODEL,
    'Reply with exactly "ok".',
  );
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
