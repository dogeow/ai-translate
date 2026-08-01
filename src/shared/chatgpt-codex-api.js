import {
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

export function buildChatGptCodexHeaders(auth, requestId = makeRequestId()) {
  const accessToken = String(auth?.accessToken || "").trim();
  if (!accessToken) {
    throw new Error("请先完成 ChatGPT 设备登录。");
  }
  const headers = {
    Accept: "text/event-stream",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Client-Request-Id": requestId,
    "Session-Id": requestId,
    "Thread-Id": requestId,
    Originator: CHATGPT_CODEX_ORIGINATOR,
    // Firefox 等环境会直接采用；Chromium 会丢弃 fetch 设置的
    // User-Agent，因此 manifest 中另有一条仅针对 Codex API 的规则。
    "User-Agent": CHATGPT_CODEX_USER_AGENT,
  };
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
    return `ChatGPT 当前无法使用所选模型。${DEFAULT_CHATGPT_MODEL} 需要支持该预览模型的 ChatGPT 账号。`;
  }
  if (status === 429) {
    return "ChatGPT 当前已达到使用限额，请稍后再试。";
  }
  if (status >= 500) {
    return `ChatGPT 服务暂时不可用（HTTP ${status}），请稍后再试。`;
  }
  return buildHttpErrorMessage(status, "ChatGPT", responseText);
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
  return auth;
}
