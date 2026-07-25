import { generateOllamaStreamingResponse } from "./ollama.js";
import { PROVIDER_OLLAMA } from "../shared/constants.js";
import {
  isMiniMaxProvider,
  isGitHubModelsProvider,
  isChatGptProvider,
} from "../shared/settings.js";
import { generateMiniMaxStreamingCompletion } from "../shared/minimax-api.js";
import { generateGitHubModelsStreamingCompletion } from "../shared/github-models-api.js";
import { generateChatGptStreamingCompletion } from "../shared/chatgpt-codex-api.js";

export const SENTENCE_STUDY_MAX_TEXT_LENGTH = 1200;
const MAX_SENTENCE_STUDY_THINKING_CHARS = 900;
const SENTENCE_STUDY_REQUEST_TIMEOUT_MS = 12000;
const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function normalizeThinkingText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSentenceStudyResponse(text) {
  const raw = String(text || "");
  if (!raw) return { content: "", thinking: "" };

  const thinkParts = [];
  let stripped = raw.replace(THINK_BLOCK_RE, (_, inner = "") => {
    const cleaned = normalizeThinkingText(inner);
    if (cleaned) thinkParts.push(cleaned);
    return "\n";
  });

  const danglingMatch = THINK_OPEN_TAG_RE.exec(stripped);
  if (danglingMatch) {
    const dangling = normalizeThinkingText(
      stripped.slice(danglingMatch.index).replace(THINK_OPEN_TAG_RE, ""),
    );
    if (dangling) thinkParts.push(dangling);
    stripped = stripped.slice(0, danglingMatch.index);
  }

  return {
    content: String(stripped || "").trim(),
    thinking: normalizeThinkingText(thinkParts.join("\n\n")),
  };
}

function appendSentenceStudyThinking(trace, thinking) {
  if (!trace || !Array.isArray(trace.thinkingSegments)) return;
  const value = normalizeThinkingText(thinking);
  if (!value) return;
  if (trace.thinkingSegments.includes(value)) return;
  trace.thinkingSegments.push(value);
}

function finalizeSentenceStudyThinking(trace) {
  if (!trace || !Array.isArray(trace.thinkingSegments)) return "";
  const merged = normalizeThinkingText(trace.thinkingSegments.join("\n\n"));
  if (!merged) return "";
  if (merged.length <= MAX_SENTENCE_STUDY_THINKING_CHARS) return merged;
  return merged.slice(0, MAX_SENTENCE_STUDY_THINKING_CHARS);
}

export function attachSentenceStudyThinking(sentenceStudy, trace) {
  if (!sentenceStudy) return null;
  const thinking = finalizeSentenceStudyThinking(trace);
  if (!thinking) return sentenceStudy;
  return {
    ...sentenceStudy,
    thinking,
  };
}

async function runSentenceStudyCompletion(base, model, prompt, runtime = {}) {
  const provider = runtime?.provider || PROVIDER_OLLAMA;
  const onThinkingProgress =
    typeof runtime?.onThinkingProgress === "function"
      ? runtime.onThinkingProgress
      : null;
  const trace = runtime?.trace || null;

  function handleStreamChunk(chunk) {
    const parsedChunk = extractSentenceStudyResponse(chunk?.response || "");
    const mergedThinking = normalizeThinkingText(
      [chunk?.thinking || "", parsedChunk.thinking || ""]
        .filter(Boolean)
        .join("\n\n"),
    );
    appendSentenceStudyThinking(trace, mergedThinking);
    const latestThinking = finalizeSentenceStudyThinking(trace);
    if (latestThinking) onThinkingProgress?.(latestThinking);
  }

  let streamed = { response: "", thinking: "" };
  if (isMiniMaxProvider(provider)) {
    streamed = await withTimeout(
      generateMiniMaxStreamingCompletion(
        base,
        runtime?.apiKey || "",
        model,
        prompt,
        { onChunk: handleStreamChunk },
      ),
      SENTENCE_STUDY_REQUEST_TIMEOUT_MS,
      "句型学习请求超时",
    );
  } else if (isGitHubModelsProvider(provider)) {
    streamed = await withTimeout(
      generateGitHubModelsStreamingCompletion(
        base,
        runtime?.apiKey || "",
        model,
        prompt,
        { onChunk: handleStreamChunk },
      ),
      SENTENCE_STUDY_REQUEST_TIMEOUT_MS,
      "句型学习请求超时",
    );
  } else if (isChatGptProvider(provider)) {
    streamed = await withTimeout(
      generateChatGptStreamingCompletion(
        base,
        "",
        model,
        prompt,
        { onChunk: handleStreamChunk },
      ),
      SENTENCE_STUDY_REQUEST_TIMEOUT_MS,
      "句型学习请求超时",
    );
  } else {
    streamed = await withTimeout(
      generateOllamaStreamingResponse(base, model, prompt, {
        onChunk: handleStreamChunk,
      }),
      SENTENCE_STUDY_REQUEST_TIMEOUT_MS,
      "句型学习请求超时",
    );
  }

  const parsed = extractSentenceStudyResponse(streamed.response || "");
  const finalThinking = normalizeThinkingText(
    [streamed.thinking || "", parsed.thinking || ""]
      .filter(Boolean)
      .join("\n\n"),
  );
  appendSentenceStudyThinking(trace, finalThinking);
  const latestThinking = finalizeSentenceStudyThinking(trace) || finalThinking;
  if (latestThinking) onThinkingProgress?.(latestThinking);

  return {
    content: parsed.content,
    thinking: latestThinking,
  };
}

export async function runSentenceStudyCompletionText(
  base,
  model,
  prompt,
  runtime = {},
  trace = null,
) {
  const { content, thinking } = await runSentenceStudyCompletion(
    base,
    model,
    prompt,
    {
      ...runtime,
      trace,
    },
  );
  appendSentenceStudyThinking(trace, thinking);
  return content;
}
