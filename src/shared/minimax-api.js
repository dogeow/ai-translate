import {
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_MODEL,
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
} from "./utils/apiUtils.js";
import { buildOpenAiChatUserContent } from "./ui-rewrite-media.js";

export function normalizeMiniMaxBaseUrl(base) {
  return normalizeApiBaseUrl(base, DEFAULT_MINIMAX_API_URL);
}

function buildMiniMaxErrorMessage(status, responseText) {
  return buildHttpErrorMessage(status, "MiniMax", responseText);
}

function flattenMaybeText(value) {
  return flattenTextContent(value, [
    "text",
    "output_text",
    "content",
    "reasoning_content",
    "reasoning",
    "thinking",
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
    flattenMaybeText(choice?.reasoning) ||
    flattenMaybeText(choice?.thinking)
  );
}

function parseMiniMaxErrorPayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.error) return "";
  const message =
    payload?.error?.message ||
    payload?.error?.msg ||
    payload?.error?.detail ||
    "";
  return String(message || "").trim();
}

function parseMiniMaxChoicePayload(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  if (choices.length === 0) return { response: "", thinking: "" };

  let response = "";
  let thinking = "";
  choices.forEach((choice) => {
    response += extractChoiceResponseText(choice);
    thinking += extractChoiceThinkingText(choice);
  });

  return {
    response,
    thinking,
  };
}

function getMiniMaxAuthHeaders(apiKey) {
  const token = String(apiKey || "").trim();
  if (!token) {
    throw new Error("请先填写 MiniMax API Key。");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function normalizeMiniMaxModelName(model) {
  if (typeof model === "string") return model.trim();
  if (!model || typeof model !== "object") return "";
  return String(
    model.id || model.model || model.name || model.model_name || "",
  ).trim();
}

function mergeModelNamesWithDefault(names) {
  const deduped = Array.from(
    new Set(
      names
        .map((name) => String(name || "").trim())
        .filter(Boolean),
    ),
  );
  if (deduped.length === 0) return [DEFAULT_MINIMAX_MODEL];
  if (!deduped.includes(DEFAULT_MINIMAX_MODEL)) {
    deduped.unshift(DEFAULT_MINIMAX_MODEL);
  }
  return deduped;
}

async function requestMiniMaxChatCompletion(base, apiKey, body) {
  const normalizedBase = normalizeMiniMaxBaseUrl(base);

  const response = await fetch(`${normalizedBase}/chat/completions`, {
    method: "POST",
    headers: getMiniMaxAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildMiniMaxErrorMessage(response.status, text));
  }

  const payload = await response.json();
  return {
    payload,
    status: response.status,
  };
}

export async function generateMiniMaxCompletion(base, apiKey, model, prompt, options = {}) {
  const normalizedBase = normalizeMiniMaxBaseUrl(base);
  const requestBody = {
    model: model || DEFAULT_MINIMAX_MODEL,
    messages: [
      { role: "user", content: buildOpenAiChatUserContent(prompt, options.images) },
    ],
    stream: false,
  };
  const trace = createAiRequestLog({
    provider: "minimax",
    endpoint: `${normalizedBase}/chat/completions`,
    model: requestBody.model,
    stream: false,
    requestContent: prompt,
    requestPayload: requestBody,
  });
  let status = null;
  let hasLogged = false;

  try {
    const { payload, status: requestStatus } = await requestMiniMaxChatCompletion(
      normalizedBase,
      apiKey,
      requestBody,
    );
    status = requestStatus;

    const { response, thinking } = parseMiniMaxChoicePayload(payload);
    const text = String(response || "").trim();
    if (!text) {
      throw new Error("MiniMax 未返回可用内容。");
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

/**
 * 调用 MiniMax chat/completions（流式）
 * @param {string} base
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 * @param {{ onChunk?: (chunk: { response: string, thinking: string }) => void }} [options]
 * @returns {Promise<{response: string, thinking: string}>}
 */
export async function generateMiniMaxStreamingCompletion(
  base,
  apiKey,
  model,
  prompt,
  options = {},
) {
  const { onChunk } = options;
  const normalizedBase = normalizeMiniMaxBaseUrl(base);
  const requestBody = {
    model: model || DEFAULT_MINIMAX_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  };
  const trace = createAiRequestLog({
    provider: "minimax",
    endpoint: `${normalizedBase}/chat/completions`,
    model: requestBody.model,
    stream: true,
    requestContent: prompt,
    requestPayload: requestBody,
  });
  let status = null;
  let hasLogged = false;
  let chunkCount = 0;

  try {
    const response = await fetch(`${normalizedBase}/chat/completions`, {
      method: "POST",
      headers: getMiniMaxAuthHeaders(apiKey),
      body: JSON.stringify(requestBody),
    });
    status = response.status;

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(buildMiniMaxErrorMessage(response.status, text));
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

    if (!response.body) {
      const payload = await response.json();
      const payloadError = parseMiniMaxErrorPayload(payload);
      if (payloadError) {
        throw new Error(payloadError);
      }
      const parsed = parseMiniMaxChoicePayload(payload);
      onChunk?.(parsed);
      const responseText = String(parsed.response || "").trim();
      const thinkingText = String(parsed.thinking || "").trim();
      logAiRequestSuccess(trace, {
        status,
        responseContent: responseText,
        extra: {
          thinkingContent: thinkingText || null,
          chunkCount: 1,
        },
      });
      hasLogged = true;
      return {
        response: responseText,
        thinking: thinkingText,
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let responseAcc = "";
    let thinkingAcc = "";
    let streamError = "";

    function applyPayloadText(payloadText) {
      const chunkText = String(payloadText || "").trim();
      if (!chunkText || chunkText === "[DONE]") return;

      let payload;
      try {
        payload = JSON.parse(chunkText);
      } catch (_) {
        return;
      }

      const payloadError = parseMiniMaxErrorPayload(payload);
      if (payloadError) {
        streamError = payloadError;
        return;
      }

      const parsed = parseMiniMaxChoicePayload(payload);
      if (!parsed.response && !parsed.thinking) return;

      responseAcc += parsed.response || "";
      thinkingAcc += parsed.thinking || "";
      chunkCount += 1;
      onChunk?.({
        response: responseAcc,
        thinking: thinkingAcc,
      });
    }

    function processSseLine(line) {
      const rawLine = String(line || "").trim();
      if (!rawLine) return;
      if (!rawLine.startsWith("data:")) return;
      applyPayloadText(rawLine.slice(5).trim());
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const newlineIndex = buffer.indexOf("\n");
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        processSseLine(line);
        if (streamError) break;
      }

      if (streamError) break;
    }

    if (!streamError) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        processSseLine(buffer);
      }
    }

    if (streamError) {
      await reader.cancel(streamError).catch(() => {});
      throw new Error(streamError);
    }

    const responseText = String(responseAcc || "").trim();
    const thinkingText = String(thinkingAcc || "").trim();
    if (!responseText && !thinkingText) {
      throw new Error("MiniMax 未返回可用内容。");
    }

    logAiRequestSuccess(trace, {
      status,
      responseContent: responseText,
      extra: {
        thinkingContent: thinkingText || null,
        chunkCount,
      },
    });
    hasLogged = true;

    return {
      response: responseText,
      thinking: thinkingText,
    };
  } catch (error) {
    if (!hasLogged) {
      logAiRequestError(trace, error, {
        status,
        extra: { chunkCount },
      });
    }
    throw error;
  }
}

export async function fetchMiniMaxModels(base, apiKey) {
  const normalizedBase = normalizeMiniMaxBaseUrl(base);
  const response = await fetch(`${normalizedBase}/models`, {
    method: "GET",
    headers: getMiniMaxAuthHeaders(apiKey),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildMiniMaxErrorMessage(response.status, text));
  }

  const payload = await response.json();
  const sourceList = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];
  const modelNames = sourceList
    .map(normalizeMiniMaxModelName)
    .filter(Boolean);
  return mergeModelNamesWithDefault(modelNames);
}

export async function testMiniMaxConnection(base, apiKey, model) {
  await requestMiniMaxChatCompletion(base, apiKey, {
    model: model || DEFAULT_MINIMAX_MODEL,
    messages: [{ role: "user", content: "Reply with OK only." }],
    stream: false,
    max_tokens: 4,
    temperature: 0,
  });
}
