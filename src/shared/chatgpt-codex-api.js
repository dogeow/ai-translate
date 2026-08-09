import {
  CHATGPT_CODEX_CLIENT_VERSION,
  CHATGPT_CODEX_ORIGINATOR,
  CHATGPT_CODEX_USER_AGENT,
  DEFAULT_CHATGPT_CODEX_API_URL,
  DEFAULT_CHATGPT_MODEL,
} from "./constants.js";
import {
  createAiRequestLog,
  logAiRequestError,
  logAiRequestSuccess,
} from "./ai-request-log.js";
import {
  getValidChatGptAuth,
} from "./chatgpt-auth.js";
import {
  buildHttpErrorMessage,
  flattenTextContent,
  parseSseLine,
  processStreamResponse,
} from "./utils/apiUtils.js";

const CHATGPT_CODEX_RESPONSES_PATH = "/responses";
const CHATGPT_CODEX_MODELS_PATH = "/models";
const CHATGPT_MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { models: string[], updatedAt: number }>} */
const chatgptModelsCache = new Map();

export function buildChatGptCodexRequestBody(
  model = DEFAULT_CHATGPT_MODEL,
  prompt = "",
) {
  return {
    model: String(model || DEFAULT_CHATGPT_MODEL).trim() ||
      DEFAULT_CHATGPT_MODEL,
    instructions:
      "Follow the user's instructions exactly. Return only the requested result without commentary.",
    input: [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: String(prompt || "") }],
      },
    ],
    tools: [],
    tool_choice: "auto",
    parallel_tool_calls: false,
    store: false,
    stream: true,
  };
}

function makeRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ai-translate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildChatGptCodexHeaders(auth, requestId = makeRequestId(), options = {}) {
  const accessToken = String(auth?.accessToken || "").trim();
  if (!accessToken) {
    throw new Error("请先完成 ChatGPT 设备登录。");
  }
  const accept = options.accept || "text/event-stream";
  const headers = {
    Accept: accept,
    Authorization: `Bearer ${accessToken}`,
    "X-Client-Request-Id": requestId,
    "Session-Id": requestId,
    "Thread-Id": requestId,
    Originator: CHATGPT_CODEX_ORIGINATOR,
    // Firefox 等环境会直接采用；Chromium 会丢弃 fetch 设置的
    // User-Agent，因此 manifest 中另有一条仅针对 Codex API 的规则。
    "User-Agent": CHATGPT_CODEX_USER_AGENT,
  };
  if (options.includeContentType !== false) {
    headers["Content-Type"] = "application/json";
  }
  if (auth.accountId) {
    headers["ChatGPT-Account-Id"] = auth.accountId;
  }
  if (auth.isFedRamp) {
    headers["X-OpenAI-FedRamp"] = "true";
  }
  return headers;
}

function buildChatGptErrorMessage(status, responseText = "") {
  if (status === 401) {
    return "ChatGPT 登录已过期，请重新完成设备登录。";
  }
  if (status === 403) {
    return "当前 ChatGPT 账号或工作区未开通 Codex 设备登录权限。";
  }
  if (status === 404) {
    return "ChatGPT 当前无法使用所选模型，请点击「测试连接」重新拉取可用模型列表。";
  }
  if (status === 429) {
    return "ChatGPT 当前已达到使用限额，请稍后再试。";
  }
  if (status >= 500) {
    return `ChatGPT 服务暂时不可用（HTTP ${status}），请稍后再试。`;
  }
  return buildHttpErrorMessage(status, "ChatGPT", responseText);
}

function extractChatGptModelSlug(model) {
  if (typeof model === "string") return model.trim();
  if (!model || typeof model !== "object") return "";
  return String(model.slug || model.id || model.name || "").trim();
}

/**
 * 从 Codex /models 响应中筛出适合展示/请求的模型 slug。
 * 隐藏项、非 API 模型以及审查专用模型会被排除。
 */
export function parseChatGptCodexModels(payload) {
  const source = Array.isArray(payload?.models)
    ? payload.models
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

  const names = [];
  const seen = new Set();
  for (const item of source) {
    const slug = extractChatGptModelSlug(item);
    if (!slug || seen.has(slug)) continue;
    if (typeof item === "object" && item) {
      const visibility = String(item.visibility || "list").toLowerCase();
      if (visibility === "hide" || visibility === "hidden") continue;
      if (item.supported_in_api === false) continue;
      if (slug === "codex-auto-review") continue;
    }
    seen.add(slug);
    names.push(slug);
  }
  return names;
}

export function buildChatGptModelsUrl(
  clientVersion = CHATGPT_CODEX_CLIENT_VERSION,
) {
  const version = String(clientVersion || CHATGPT_CODEX_CLIENT_VERSION).trim();
  const base = `${DEFAULT_CHATGPT_CODEX_API_URL}${CHATGPT_CODEX_MODELS_PATH}`;
  return `${base}?client_version=${encodeURIComponent(version)}`;
}

/**
 * 探测当前 ChatGPT 账号可用的 Codex 模型列表。
 * @returns {Promise<string[]>}
 */
export async function fetchChatGptModels(options = {}) {
  const { forceRefresh = false, fetchImpl = fetch } = options;
  const auth =
    options.auth ||
    (await getValidChatGptAuth(options.authOptions || {}));
  const cacheKey = String(auth.accountId || auth.email || "default");
  const cached = chatgptModelsCache.get(cacheKey);
  const now = Date.now();
  if (
    !forceRefresh &&
    cached &&
    now - cached.updatedAt < CHATGPT_MODELS_CACHE_TTL_MS
  ) {
    return [...cached.models];
  }

  const endpoint = buildChatGptModelsUrl(
    options.clientVersion || CHATGPT_CODEX_CLIENT_VERSION,
  );
  let response = await fetchImpl(endpoint, {
    method: "GET",
    headers: buildChatGptCodexHeaders(auth, makeRequestId(), {
      accept: "application/json",
      includeContentType: false,
    }),
  });

  if (response.status === 401 && !options.auth) {
    const refreshed = await getValidChatGptAuth({
      ...(options.authOptions || {}),
      forceRefresh: true,
    });
    response = await fetchImpl(endpoint, {
      method: "GET",
      headers: buildChatGptCodexHeaders(refreshed, makeRequestId(), {
        accept: "application/json",
        includeContentType: false,
      }),
    });
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(buildChatGptErrorMessage(response.status, responseText));
  }

  const payload = await response.json().catch(() => null);
  const models = parseChatGptCodexModels(payload);
  if (models.length === 0) {
    throw new Error("ChatGPT 未返回可用模型，请确认账号已开通 Codex。");
  }

  chatgptModelsCache.set(cacheKey, {
    models: [...models],
    updatedAt: now,
  });
  return [...models];
}

function extractResponseOutput(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .filter((item) => item?.type === "message" || item?.content)
    .map((item) =>
      flattenTextContent(item?.content, ["text", "output_text", "content"]),
    )
    .filter(Boolean)
    .join("");
}

export function parseChatGptCodexEvent(payload) {
  if (!payload || typeof payload !== "object") {
    return { response: "", finalResponse: "", error: "" };
  }
  const type = String(payload.type || "");

  if (type === "response.output_text.delta") {
    return {
      response: String(payload.delta || ""),
      finalResponse: "",
      error: "",
    };
  }

  if (
    type === "response.output_text.done" ||
    type === "response.content_part.done"
  ) {
    return {
      response: "",
      finalResponse: String(
        payload.text || payload.part?.text || "",
      ),
      error: "",
    };
  }

  if (type === "response.output_item.done") {
    return {
      response: "",
      finalResponse: flattenTextContent(payload.item?.content, [
        "text",
        "output_text",
        "content",
      ]),
      error: "",
    };
  }

  if (type === "response.completed") {
    return {
      response: "",
      finalResponse: extractResponseOutput(payload.response),
      error: "",
    };
  }

  if (type === "error" || type === "response.failed") {
    return {
      response: "",
      finalResponse: "",
      error: String(
        payload.error?.message ||
          payload.response?.error?.message ||
          payload.message ||
          "ChatGPT 请求失败。",
      ),
    };
  }

  return { response: "", finalResponse: "", error: "" };
}

async function sendChatGptCodexRequest({
  model,
  prompt,
  auth,
  fetchImpl,
}) {
  const requestBody = buildChatGptCodexRequestBody(model, prompt);
  const endpoint = `${DEFAULT_CHATGPT_CODEX_API_URL}${CHATGPT_CODEX_RESPONSES_PATH}`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: buildChatGptCodexHeaders(auth),
    body: JSON.stringify(requestBody),
  });
  return { response, requestBody, endpoint };
}

async function openChatGptCodexStream(model, prompt, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  let auth =
    options.auth ||
    (await getValidChatGptAuth(options.authOptions || {}));
  let result = await sendChatGptCodexRequest({
    model,
    prompt,
    auth,
    fetchImpl,
  });

  if (result.response.status === 401 && !options.auth) {
    auth = await getValidChatGptAuth({
      ...(options.authOptions || {}),
      forceRefresh: true,
    });
    result = await sendChatGptCodexRequest({
      model,
      prompt,
      auth,
      fetchImpl,
    });
  }

  if (!result.response.ok) {
    const responseText = await result.response.text();
    const error = new Error(
      buildChatGptErrorMessage(result.response.status, responseText),
    );
    error.status = result.response.status;
    error.responseText = responseText;
    throw error;
  }

  return result;
}

export async function generateChatGptStreamingCompletion(
  _base,
  _apiKey,
  model,
  prompt,
  options = {},
) {
  const requestBody = buildChatGptCodexRequestBody(model, prompt);
  const endpoint = `${DEFAULT_CHATGPT_CODEX_API_URL}${CHATGPT_CODEX_RESPONSES_PATH}`;
  const trace = createAiRequestLog({
    provider: "chatgpt",
    endpoint,
    model: requestBody.model,
    stream: true,
    requestContent: prompt,
    requestPayload: requestBody,
  });
  let status = null;
  let chunkCount = 0;
  let responseText = "";
  let finalResponseText = "";

  try {
    const opened = await openChatGptCodexStream(model, prompt, options);
    status = opened.response.status;

    await processStreamResponse(opened.response, async (line) => {
      const parsedLine = parseSseLine(line);
      if (!parsedLine || parsedLine.done || !parsedLine.data) return;
      const event = parseChatGptCodexEvent(parsedLine.data);
      if (event.error) {
        throw new Error(event.error);
      }
      if (event.response) {
        chunkCount += 1;
        responseText += event.response;
        options.onChunk?.({ response: event.response, thinking: "" });
      }
      if (event.finalResponse) {
        finalResponseText = event.finalResponse;
      }
    });

    const finalResponse = String(
      responseText || finalResponseText || "",
    ).trim();
    if (!finalResponse) {
      throw new Error("ChatGPT 未返回可用内容。");
    }
    logAiRequestSuccess(trace, {
      status,
      responseContent: finalResponse,
      extra: { chunkCount },
    });
    return { response: finalResponse, thinking: "" };
  } catch (error) {
    logAiRequestError(trace, error, { status, extra: { chunkCount } });
    throw error;
  }
}

export async function generateChatGptCompletion(
  base,
  apiKey,
  model,
  prompt,
  options = {},
) {
  const result = await generateChatGptStreamingCompletion(
    base,
    apiKey,
    model,
    prompt,
    options,
  );
  return result.response;
}

export async function testChatGptConnection(
  model = DEFAULT_CHATGPT_MODEL,
  options = {},
) {
  const auth = await getValidChatGptAuth({
    ...(options.authOptions || {}),
    forceRefresh: options.forceRefresh === true,
  });
  if (options.probe === false) return auth;

  // 优先探测模型列表；列表不可用时再回退到发送一条最小 completion。
  if (options.listModels !== false) {
    try {
      const models = await fetchChatGptModels({
        auth,
        forceRefresh: true,
        fetchImpl: options.fetchImpl,
        clientVersion: options.clientVersion,
      });
      return { auth, models };
    } catch (listError) {
      if (options.allowCompletionFallback === false) {
        throw listError;
      }
    }
  }

  await generateChatGptCompletion(
    "",
    "",
    model,
    "Reply with exactly OK and no other text.",
    {
      auth,
      fetchImpl: options.fetchImpl,
    },
  );
  return { auth, models: [model] };
}
