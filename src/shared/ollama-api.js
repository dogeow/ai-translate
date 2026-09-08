/**
 * Ollama API 统一调用层
 * 提供 generate、tags 等 API 的统一封装
 */

import { DEFAULT_OLLAMA_URL } from "./constants.js";
import { getOllamaErrorMessage } from "./ollama-errors.js";
import {
  createAiRequestLog,
  logAiRequestError,
  logAiRequestSuccess,
} from "./ai-request-log.js";
import {
  buildHttpErrorMessage,
  buildJsonRequestOptions,
  normalizeApiBaseUrl,
  safeJsonParse,
} from "./utils/apiUtils.js";
import {
  normalizeRewriteImages,
  stripDataUrlToBase64,
} from "./ui-rewrite-media.js";

function normalizeOllamaBaseUrl(base) {
  return normalizeApiBaseUrl(base, DEFAULT_OLLAMA_URL);
}

async function requestOllamaGenerate(base, requestBody) {
  const normalizedBase = normalizeOllamaBaseUrl(base);
  const endpoint = `${normalizedBase}/api/generate`;
  const response = await fetch(
    endpoint,
    buildJsonRequestOptions("POST", requestBody),
  );
  return { endpoint, response };
}

/**
 * 调用 Ollama generate API（非流式）
 * @param {string} base - Ollama 服务地址，如 http://127.0.0.1:11434
 * @param {string} model - 模型名称
 * @param {string} prompt - 提示词
 * @param {{ images?: Array<{ dataUrl?: string } | string> }} [options]
 * @returns {Promise<string>} 生成的文本
 */
export async function generateCompletion(base, model, prompt, options = {}) {
  const requestBody = { model, prompt, stream: false };
  const images = normalizeRewriteImages(options.images).map((image) =>
    stripDataUrlToBase64(image.dataUrl),
  );
  if (images.length > 0) {
    requestBody.images = images;
  }
  const normalizedBase = normalizeOllamaBaseUrl(base);
  const endpoint = `${normalizedBase}/api/generate`;
  const trace = createAiRequestLog({
    provider: "ollama",
    endpoint,
    model,
    stream: false,
    requestContent: prompt,
    requestPayload: requestBody,
  });

  let status = null;
  let hasLogged = false;

  try {
    const { response } = await requestOllamaGenerate(normalizedBase, requestBody);
    status = response.status;

    if (!response.ok) {
      const text = await response.text();
      const error = createGenerateError(response, text);
      logAiRequestError(trace, error, {
        status,
        extra: { errorBody: text || null },
      });
      hasLogged = true;
      throw error;
    }

    const data = (await safeJsonParse(response)) || {};
    const output = (data.response || "").trim();
    logAiRequestSuccess(trace, {
      status,
      responseContent: output,
      extra: {
        thinkingLength: String(data.thinking || "").trim().length,
      },
    });
    hasLogged = true;
    return output;
  } catch (error) {
    if (!hasLogged) {
      logAiRequestError(trace, error, { status });
    }
    throw error;
  }
}

function createGenerateError(response, text) {
  if (response.status === 403) {
    return new Error(getOllamaErrorMessage("403"));
  }
  return new Error(buildHttpErrorMessage(response.status, "Ollama", text));
}

function parseStreamLine(line) {
  const raw = String(line || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * 调用 Ollama generate API（流式）
 * @param {string} base - Ollama 服务地址，如 http://127.0.0.1:11434
 * @param {string} model - 模型名称
 * @param {string} prompt - 提示词
 * @param {{ onChunk?: (chunk: { response: string, thinking: string }) => void }} [options]
 * @returns {Promise<{response: string, thinking: string}>}
 */
export async function generateStreamingCompletion(
  base,
  model,
  prompt,
  options = {},
) {
  const { onChunk } = options;
  const requestBody = { model, prompt, stream: true };
  const normalizedBase = normalizeOllamaBaseUrl(base);
  const endpoint = `${normalizedBase}/api/generate`;
  const trace = createAiRequestLog({
    provider: "ollama",
    endpoint,
    model,
    stream: true,
    requestContent: prompt,
    requestPayload: requestBody,
  });
  let status = null;
  let hasLogged = false;
  let chunkCount = 0;

  try {
    const { response } = await requestOllamaGenerate(normalizedBase, requestBody);
    status = response.status;

    if (!response.ok) {
      const text = await response.text();
      const error = createGenerateError(response, text);
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
      const data = (await safeJsonParse(response)) || {};
      if (typeof data.error === "string" && data.error.trim()) {
        throw new Error(data.error.trim());
      }
      const chunk = {
        response: data.response || "",
        thinking: data.thinking || "",
      };
      onChunk?.(chunk);
      const finalResponse = chunk.response.trim();
      const finalThinking = chunk.thinking.trim();
      logAiRequestSuccess(trace, {
        status,
        responseContent: finalResponse,
        extra: {
          thinkingContent: finalThinking || null,
          chunkCount: 1,
        },
      });
      hasLogged = true;
      return {
        response: finalResponse,
        thinking: finalThinking,
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedResponse = "";
    let accumulatedThinking = "";
    let streamError = "";

    function handleChunkLine(line) {
      const payload = parseStreamLine(line);
      if (!payload) return;

      const payloadError =
        typeof payload.error === "string" ? payload.error.trim() : "";
      if (payloadError) {
        streamError = payloadError;
        return;
      }

      let hasDelta = false;

      if (typeof payload.response === "string" && payload.response) {
        accumulatedResponse += payload.response;
        hasDelta = true;
      }

      if (typeof payload.thinking === "string" && payload.thinking) {
        accumulatedThinking += payload.thinking;
        hasDelta = true;
      }

      if (hasDelta) {
        chunkCount += 1;
        onChunk?.({
          response: accumulatedResponse,
          thinking: accumulatedThinking,
        });
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const newlineIndex = buffer.indexOf("\n");
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        handleChunkLine(line);
        if (streamError) break;
      }

      if (streamError) break;
    }

    if (!streamError) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        handleChunkLine(buffer);
      }
    }

    if (streamError) {
      await reader.cancel(streamError).catch(() => {});
      throw new Error(streamError);
    }

    const finalResponse = accumulatedResponse.trim();
    const finalThinking = accumulatedThinking.trim();
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
      logAiRequestError(trace, error, {
        status,
        extra: { chunkCount },
      });
    }
    throw error;
  }
}

/**
 * 获取 Ollama 可用模型列表
 * @param {string} base - Ollama 服务地址
 * @returns {Promise<{models?: Array, error?: string}>}
 */
export async function fetchModels(base) {
  const tagsUrl = `${normalizeOllamaBaseUrl(base)}/api/tags`;

  try {
    const response = await fetch(tagsUrl);
    if (response.status === 403) {
      return { error: "403" };
    }
    if (!response.ok) {
      return { error: "connection" };
    }
    const data = (await safeJsonParse(response)) || {};
    return { models: data.models || [] };
  } catch (_) {
    return { error: "connection" };
  }
}

/**
 * 检查 Ollama 连接并获取模型列表
 * @param {string} ollamaUrl - Ollama 服务地址
 * @returns {Promise<{models?: Array, error?: string}>}
 */
export async function checkOllamaAndGetModels(ollamaUrl) {
  return fetchModels(normalizeOllamaBaseUrl(ollamaUrl));
}
