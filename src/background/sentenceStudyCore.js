import { generateOllamaStreamingResponse } from "./ollama.js";
import { PROVIDER_OLLAMA } from "../shared/constants.js";
import {
  isMiniMaxProvider,
  isGitHubModelsProvider,
} from "../shared/settings.js";
import { generateMiniMaxStreamingCompletion } from "../shared/minimax-api.js";
import { generateGitHubModelsStreamingCompletion } from "../shared/github-models-api.js";

const SENTENCE_STUDY_MAX_TEXT_LENGTH = 1200;
const MAX_SENTENCE_STUDY_THINKING_CHARS = 900;
const SENTENCE_STUDY_REQUEST_TIMEOUT_MS = 12000;
const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;
const AUXILIARY_VERBS = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "can",
  "could",
  "will",
  "would",
  "should",
  "may",
  "might",
  "must",
]);
const PREPOSITIONS = new Set([
  "for",
  "to",
  "without",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "as",
  "if",
  "when",
  "while",
  "because",
  "after",
  "before",
  "during",
  "through",
  "into",
  "about",
  "over",
  "under",
]);
const SENTENCE_PART_LABELS = new Set([
  "主语",
  "系动词",
  "谓语",
  "宾语",
  "表语",
  "状语",
  "从句",
  "定语",
  "主句",
  "补足成分",
  "助动词",
  "动词",
  "成分",
]);

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
        {
          onChunk: handleStreamChunk,
        },
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
        {
          onChunk: handleStreamChunk,
        },
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

function normalizeThinkingText(text) {
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

function attachSentenceStudyThinking(sentenceStudy, trace) {
  if (!sentenceStudy) return null;
  const thinking = finalizeSentenceStudyThinking(trace);
  if (!thinking) return sentenceStudy;
  return {
    ...sentenceStudy,
    thinking,
  };
}

async function runSentenceStudyCompletionText(
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

function normalizeInlineWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePartTranslation(text) {
  return String(text || "")
    .trim()
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/^(中文|释义|翻译)[:：]\s*/u, "")
    .replace(/^[\-\d.)\s]+/, "")
    .replace(/[。；;]+$/u, "")
    .trim()
    .slice(0, 40);
}

function hasLatinLetters(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

function hasCjkChars(text) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(String(text || ""));
}

function extractLatinTokens(text) {
  return String(text || "").match(/[A-Za-z][A-Za-z0-9.+-]*/g) || [];
}

function normalizeComparableText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s.,!?;:，。！？；："'`‘’“”\-_/\\()[\]{}]+/g, "")
    .trim();
}

const PART_TRANSLATION_ALLOWED_EN_TOKENS = new Set([
  "next.js",
  "nextjs",
  "react",
  "minimax",
  "ollama",
  "api",
  "url",
  "html",
  "css",
  "js",
]);

function isLikelyUntranslatedPart(part, translation) {
  const value = sanitizePartTranslation(translation);
  if (!value) return true;
  const source = sanitizePartTranslation(part?.text || "");
  if (
    source &&
    normalizeComparableText(value) === normalizeComparableText(source)
  ) {
    return true;
  }
  if (hasLatinLetters(value) && !hasCjkChars(value)) return true;
  if (hasLatinLetters(value) && hasCjkChars(value)) {
    const sourceTokenSet = new Set(
      extractLatinTokens(source).map((token) => token.toLowerCase()),
    );
    const valueTokens = extractLatinTokens(value).map((token) =>
      token.toLowerCase(),
    );
    const hasSuspiciousToken = valueTokens.some((token) => {
      if (PART_TRANSLATION_ALLOWED_EN_TOKENS.has(token)) return false;
      if (!sourceTokenSet.has(token)) return false;
      if (!/^[a-z]{3,}$/.test(token)) return false;
      return true;
    });
    if (hasSuspiciousToken) return true;
  }
  return false;
}

function hasKana(text) {
  return /[\u3040-\u30ff\u31f0-\u31ff]/.test(String(text || ""));
}

function getFirstSentence(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : normalized).trim();
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function normalizeSentenceStudy(data) {
  if (!data || typeof data !== "object") return null;

  const pattern = String(data.pattern || "")
    .trim()
    .slice(0, 80);
  const parts = [];

  if (Array.isArray(data.parts)) {
    data.parts.slice(0, 6).forEach((part) => {
      const text = String(part?.text || "")
        .trim()
        .slice(0, 120);
      if (!text) return;
      const previousLabel = getLastPart(parts)?.label || "";
      const rawLabel = String(part?.label || "")
        .trim()
        .slice(0, 40);
      const label = SENTENCE_PART_LABELS.has(rawLabel)
        ? rawLabel
        : inferPartLabel(text, previousLabel);
      parts.push({
        text,
        translation: String(part?.translation || "")
          .trim()
          .slice(0, 120),
        label,
        note: String(part?.note || "")
          .trim()
          .slice(0, 80),
      });
    });
  }

  if (!pattern || parts.length === 0) return null;

  return {
    pattern,
    parts,
  };
}

function getLastPart(parts) {
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function joinPartTexts(parts) {
  return parts
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:?!])/g, "$1")
    .trim();
}

function inferSentencePattern(parts) {
  const labels = parts
    .map((part) => String(part.label || "").trim())
    .filter(Boolean);
  return labels.join("+") || "句型分析";
}

function normalizeSentencePattern(pattern, parts) {
  const raw = String(pattern || "").trim();
  if (!raw) return inferSentencePattern(parts);
  if (raw.length > 40) return inferSentencePattern(parts);
  if (/[A-Za-z]{3,}/.test(raw)) return inferSentencePattern(parts);
  if (hasKana(raw)) return inferSentencePattern(parts);
  return raw;
}

function inferPartLabel(text, previousLabel = "") {
  const trimmed = String(text || "").trim();
  const firstWord = trimmed
    .replace(/^[^A-Za-z]+/, "")
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (!trimmed) return "成分";
  if (/^(am|is|are|was|were|be|been|being)$/i.test(trimmed)) return "系动词";
  if (AUXILIARY_VERBS.has(firstWord)) {
    return "助动词";
  }
  if (!previousLabel) return "主语";
  if (previousLabel === "主语") return "谓语";
  if (previousLabel === "系动词") return "表语";
  if (PREPOSITIONS.has(firstWord)) {
    return "状语";
  }
  return "补足成分";
}

function mergeLeadingSubjectPhrase(parts) {
  if (!Array.isArray(parts) || parts.length < 2) return parts || [];
  const verbLabels = new Set(["系动词", "谓语", "助动词", "动词"]);
  const boundaryLabels = new Set(["状语", "从句", "表语", "宾语"]);
  const firstVerbIndex = parts.findIndex((part) =>
    verbLabels.has(String(part.label || "").trim()),
  );
  if (firstVerbIndex <= 0) return parts;

  const leading = parts.slice(0, firstVerbIndex);
  if (
    leading.some((part, index) => {
      const label = String(part.label || "").trim();
      if (index === 0) return false;
      return boundaryLabels.has(label);
    })
  ) {
    return parts;
  }

  return [
    {
      text: joinPartTexts(leading),
      translation: "",
      label: "主语",
      note: "",
    },
    ...parts.slice(firstVerbIndex),
  ];
}

function splitLeakedSubjectVerb(part) {
  if (String(part?.label || "").trim() !== "主语") return [part];
  const match = String(part.text || "").match(
    /^(.*?)(?:\s+)(am|is|are|was|were|be|been|being)$/i,
  );
  if (!match) return [part];
  const subjectText = match[1].trim();
  const verbText = match[2].trim();
  if (!subjectText || !verbText) return [part];
  return [
    {
      ...part,
      text: subjectText,
      translation: "",
      note: part.note || "",
    },
    {
      text: verbText,
      translation: "",
      label: "系动词",
      note: "",
    },
  ];
}

function pushSentencePart(parts, part) {
  const text = String(part?.text || "");
  if (!normalizeInlineWhitespace(text)) return;
  const normalized = {
    text: text.trim(),
    translation: String(part?.translation || "").trim(),
    label: String(part?.label || "").trim() || inferPartLabel(text),
    note: String(part?.note || "").trim(),
  };
  if (/^[.?!,:;]+$/.test(normalized.text) && parts.length > 0) {
    parts[parts.length - 1].text += normalized.text;
    return;
  }
  parts.push(normalized);
}

function finalizeSentenceStudy(sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const parts = mergeLeadingSubjectPhrase(sentenceStudy.parts);
  if (parts.length === 0) return null;
  return {
    pattern: normalizeSentencePattern(sentenceStudy.pattern, parts),
    parts,
  };
}

function validateSentenceStudyCoverage(original, sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;

  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  let cursor = 0;
  for (const part of sentenceStudy.parts) {
    const index = targetSentence.indexOf(part.text, cursor);
    if (index === -1) return null;
    if (normalizeInlineWhitespace(targetSentence.slice(cursor, index)) !== "") {
      return null;
    }
    const end = index + part.text.length;
    const previousChar = index > 0 ? targetSentence[index - 1] : "";
    const nextChar = end < targetSentence.length ? targetSentence[end] : "";
    const firstChar = part.text[0] || "";
    const lastChar = part.text[part.text.length - 1] || "";
    if (/[A-Za-z]/.test(previousChar) && /[A-Za-z]/.test(firstChar)) {
      return null;
    }
    if (/[A-Za-z]/.test(lastChar) && /[A-Za-z]/.test(nextChar)) {
      return null;
    }
    if (!SENTENCE_PART_LABELS.has(String(part.label || "").trim())) {
      return null;
    }
    cursor = end;
  }

  if (normalizeInlineWhitespace(targetSentence.slice(cursor)) !== "") {
    return null;
  }

  const combined = normalizeInlineWhitespace(
    sentenceStudy.parts.map((part) => part.text).join(" "),
  );
  if (combined !== normalizeInlineWhitespace(targetSentence)) return null;

  return sentenceStudy;
}

function repairSentenceStudyCoverage(original, sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  if (validateSentenceStudyCoverage(original, sentenceStudy)) {
    return sentenceStudy;
  }

  const rawParts = sentenceStudy.parts.flatMap(splitLeakedSubjectVerb);
  const repairedParts = [];
  let cursor = 0;

  for (const rawPart of rawParts) {
    let candidate = String(rawPart.text || "").trim();
    if (!candidate) continue;
    let index = targetSentence.indexOf(candidate, cursor);
    if (index === -1) {
      const withoutTrailingPunctuation = candidate.replace(/[.?!,:;]+$/, "");
      if (
        withoutTrailingPunctuation &&
        withoutTrailingPunctuation !== candidate
      ) {
        candidate = withoutTrailingPunctuation;
        index = targetSentence.indexOf(candidate, cursor);
      }
    }
    if (index === -1) continue;

    const gap = targetSentence.slice(cursor, index);
    if (normalizeInlineWhitespace(gap)) {
      pushSentencePart(repairedParts, {
        text: gap,
        label: inferPartLabel(gap, getLastPart(repairedParts)?.label),
      });
    }

    pushSentencePart(repairedParts, {
      ...rawPart,
      text: targetSentence.slice(index, index + candidate.length),
    });
    cursor = index + candidate.length;
  }

  const tail = targetSentence.slice(cursor);
  if (normalizeInlineWhitespace(tail)) {
    pushSentencePart(repairedParts, {
      text: tail,
      label: inferPartLabel(tail, getLastPart(repairedParts)?.label),
    });
  }

  if (repairedParts.length === 0) return null;

  return finalizeSentenceStudy({
    pattern: sentenceStudy.pattern || inferSentencePattern(repairedParts),
    parts: repairedParts,
  });
}

function buildHeuristicSentenceStudy(original) {
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  const parts = [];

  function splitMainClause(mainClauseText) {
    const clauseParts = [];
    const words = String(mainClauseText || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return clauseParts;

    function cleanWord(word) {
      return String(word || "")
        .toLowerCase()
        .replace(/^[^a-z]+|[^a-z]+$/gi, "");
    }

    function isLikelyFiniteVerb(token) {
      if (!token) return false;
      if (AUXILIARY_VERBS.has(token)) return true;
      if (
        /^(enable|enables|allow|allows|help|helps|make|makes|provide|provides)$/i.test(
          token,
        )
      ) {
        return true;
      }
      return /^[a-z]{3,}(s|ed)$/i.test(token);
    }

    const verbIndex = words.findIndex((word) =>
      isLikelyFiniteVerb(cleanWord(word)),
    );
    if (verbIndex <= 0) {
      pushSentencePart(clauseParts, { text: mainClauseText, label: "主句" });
      return clauseParts;
    }

    const subject = words.slice(0, verbIndex).join(" ");
    const verb = words[verbIndex];
    const restWords = words.slice(verbIndex + 1);
    pushSentencePart(clauseParts, { text: subject, label: "主语" });
    pushSentencePart(clauseParts, {
      text: verb,
      label: inferPartLabel(verb, "主语"),
    });

    if (restWords.length === 0) return clauseParts;

    const firstRestToken = cleanWord(restWords[0]);
    const objectPronouns = new Set([
      "me",
      "you",
      "him",
      "her",
      "it",
      "us",
      "them",
    ]);

    let remainingWords = restWords;
    if (objectPronouns.has(firstRestToken)) {
      pushSentencePart(clauseParts, {
        text: restWords[0],
        label: "宾语",
      });
      remainingWords = restWords.slice(1);
    }

    const remaining = remainingWords.join(" ").trim();
    if (!remaining) return clauseParts;

    const restChunks = remaining
      .split(
        /\s+(?=with|without|in|on|at|by|from|as|if|when|while|because|after|before)\b/i,
      )
      .filter(Boolean);

    restChunks.forEach((chunk, index) => {
      const label =
        index === 0 ? (/^to\b/i.test(chunk) ? "补足成分" : "宾语") : "状语";
      pushSentencePart(clauseParts, { text: chunk, label });
    });

    return clauseParts;
  }

  const commaIndex = targetSentence.indexOf(",");
  if (commaIndex > 0 && commaIndex < targetSentence.length - 1) {
    const lead = targetSentence.slice(0, commaIndex + 1).trim();
    const mainClause = targetSentence.slice(commaIndex + 1).trim();
    if (lead && mainClause) {
      pushSentencePart(parts, { text: lead, label: "状语" });
      splitMainClause(mainClause).forEach((part) =>
        pushSentencePart(parts, part),
      );
    }
  }

  if (parts.length > 1) {
    return finalizeSentenceStudy({
      pattern: inferSentencePattern(parts),
      parts,
    });
  }

  const fallbackParts = [];
  const words = targetSentence.split(/\s+/);
  const verbIndex = words.findIndex((word) =>
    /^(am|is|are|was|were|be|been|being|do|does|did|have|has|had|can|could|will|would|should|may|might|must)$/i.test(
      word.replace(/[.?!,:;]+$/g, ""),
    ),
  );

  if (verbIndex > 0) {
    const subject = words.slice(0, verbIndex).join(" ");
    const verb = words[verbIndex];
    const rest = words.slice(verbIndex + 1).join(" ");
    pushSentencePart(fallbackParts, { text: subject, label: "主语" });
    pushSentencePart(fallbackParts, {
      text: verb,
      label: inferPartLabel(verb, "主语"),
    });
    if (rest) {
      const restChunks = rest
        .split(
          /\s+(?=without|with|in|on|at|by|from|as|if|when|while|because|after|before)\b/i,
        )
        .filter(Boolean);
      restChunks.forEach((chunk, index) => {
        pushSentencePart(fallbackParts, {
          text: chunk,
          label: index === 0 && /^(for|to)\b/i.test(chunk) ? "表语" : "状语",
        });
      });
    }
  } else {
    pushSentencePart(fallbackParts, { text: targetSentence, label: "主句" });
  }

  return fallbackParts.length > 0
    ? finalizeSentenceStudy({
        pattern: inferSentencePattern(fallbackParts),
        parts: fallbackParts,
      })
    : null;
}

function shouldUseHeuristicFallback(sentenceStudy, original) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return true;
  const parts = sentenceStudy.parts;
  if (parts.length <= 1) return true;

  const targetSentence = normalizeInlineWhitespace(getFirstSentence(original));
  const combined = normalizeInlineWhitespace(
    parts.map((part) => part.text).join(" "),
  );
  if (targetSentence && combined !== targetSentence) return true;

  const uniqueLabels = new Set(
    parts.map((part) => String(part.label || "").trim()).filter(Boolean),
  );
  if (uniqueLabels.size <= 1 && parts.length <= 2) return true;

  return false;
}

const STATIC_TRANSLATIONS = {
  // copular verbs
  am: "是",
  is: "是",
  are: "是",
  was: "是",
  were: "是",
  be: "是",
  been: "是",
  being: "是",
  // demonstratives
  this: "这",
  that: "那",
  these: "这些",
  those: "那些",
  // prepositions
  in: "在",
  on: "在",
  at: "在",
  by: "通过",
  with: "带有",
  without: "不需",
  for: "用于",
  to: "去",
};

const LOCAL_WORD_TRANSLATIONS = {
  i: "我",
  me: "我",
  my: "我的",
  we: "我们",
  our: "我们的",
  you: "你",
  your: "你的",
  he: "他",
  she: "她",
  they: "他们",
  this: "这",
  that: "那",
  these: "这些",
  those: "那些",
  it: "它",
  is: "是",
  are: "是",
  was: "是",
  were: "是",
  be: "是",
  being: "是",
  been: "是",
  enable: "使能够",
  enables: "使能够",
  enabled: "使能够",
  allow: "允许",
  allows: "允许",
  allowed: "允许",
  help: "帮助",
  helps: "帮助",
  create: "创建",
  build: "构建",
  use: "使用",
  used: "被使用",
  using: "使用",
  some: "一些",
  world: "世界",
  worlds: "世界",
  largest: "最大的",
  large: "大型",
  company: "公司",
  companies: "公司",
  high: "高",
  quality: "质量",
  "high-quality": "高质量",
  web: "网页",
  documentation: "文档",
  document: "文档",
  example: "示例",
  examples: "示例",
  application: "应用",
  applications: "应用程序",
  power: "能力",
  component: "组件",
  components: "组件",
  need: "需要",
  needs: "需要",
  needed: "需要",
  needing: "需要",
  permission: "许可",
  permissions: "许可",
  by: "通过",
  with: "借助",
  without: "无需",
  for: "用于",
  to: "去",
  in: "在",
  on: "在",
  at: "在",
  of: "的",
  and: "和",
};

function joinLocalizedTokens(tokens) {
  let merged = "";
  for (const token of tokens) {
    const part = String(token || "").trim();
    if (!part) continue;
    if (!merged) {
      merged = part;
      continue;
    }
    const prevHasLatin = hasLatinLetters(merged[merged.length - 1]);
    const nextHasLatin = hasLatinLetters(part[0]);
    if (prevHasLatin && nextHasLatin) {
      merged += ` ${part}`;
    } else {
      merged += part;
    }
  }
  return merged;
}

function translateEnglishPhraseLocally(text) {
  const source = String(text || "").trim();
  if (!source) return "";
  if (/^['’]?s$/i.test(source)) return "的";

  const powerMatch = source.match(/^with\s+the\s+power\s+of\s+(.+)$/i);
  if (powerMatch) {
    const body =
      translateEnglishPhraseLocally(powerMatch[1]) || powerMatch[1].trim();
    return sanitizePartTranslation(`借助${body}的能力`);
  }

  const usedByMatch = source.match(/^used\s+by\s+(.+)$/i);
  if (usedByMatch) {
    const body =
      translateEnglishPhraseLocally(usedByMatch[1]) || usedByMatch[1].trim();
    return sanitizePartTranslation(`被${body}使用`);
  }

  const tokens = source.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  const translated = [];
  for (const token of tokens) {
    const cleaned = String(token).replace(
      /^[^A-Za-z0-9]+|[^A-Za-z0-9.'+-]+$/g,
      "",
    );
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    let mapped = LOCAL_WORD_TRANSLATIONS[lower] || "";

    if (!mapped && lower.endsWith("'s")) {
      const root = lower.slice(0, -2);
      const rootMapped = LOCAL_WORD_TRANSLATIONS[root] || root;
      mapped = rootMapped ? `${rootMapped}的` : "";
    }
    if (!mapped && lower.endsWith("s")) {
      const singular = lower.slice(0, -1);
      mapped = LOCAL_WORD_TRANSLATIONS[singular] || "";
    }
    if (!mapped && /^(next\.js|react)$/i.test(cleaned)) {
      mapped = cleaned;
    }
    if (!mapped && /^[A-Z][A-Za-z0-9.]*$/.test(cleaned)) {
      mapped = cleaned;
    }
    if (!mapped) {
      mapped = cleaned;
    }
    translated.push(mapped);
  }

  const merged = joinLocalizedTokens(translated);
  return sanitizePartTranslation(merged);
}

function getStaticPartTranslation(part) {
  const text = String(part?.text || "")
    .trim()
    .replace(/[.?!,:;]+$/g, "")
    .toLowerCase();
  const label = String(part?.label || "").trim();

  if (!text) return "";
  if (label === "系动词" && STATIC_TRANSLATIONS[text]) {
    return STATIC_TRANSLATIONS[text];
  }
  return STATIC_TRANSLATIONS[text] || "";
}

const LOCATIVE_PREPOSITIONS = new Set(["in", "on", "at"]);

function combinePrepositionalTranslation(preposition, bodyTranslation) {
  const prefix = String(preposition || "")
    .trim()
    .toLowerCase();
  const body = sanitizePartTranslation(bodyTranslation);
  if (!body) return "";

  if (LOCATIVE_PREPOSITIONS.has(prefix)) {
    return body.endsWith("中") || body.endsWith("内")
      ? `在${body}`
      : `在${body}中`;
  }
  if (prefix === "without") return `不需要${body}`;
  if (prefix === "with") return `带有${body}`;
  if (prefix === "by") return `通过${body}`;
  if (prefix === "for") return `用于${body}`;
  if (prefix === "to") return `去${body}`;
  return "";
}

function buildLocalPartTranslation(part, fullTranslation, index) {
  const sourceText = String(part?.text || "").trim();
  if (!sourceText) return "";
  if (/^['’]?s$/i.test(sourceText)) return "的";

  const staticTranslation = getStaticPartTranslation(part);
  if (staticTranslation) return staticTranslation;

  const translatedSentence = String(fullTranslation || "").trim();
  if (index === 0 && /[,，]/.test(sourceText) && translatedSentence) {
    const leadingClause = translatedSentence.match(/^(.+?)[，,]/u)?.[1] || "";
    const clauseCandidate = sanitizePartTranslation(leadingClause);
    if (clauseCandidate) return clauseCandidate;
  }

  const phraseMatch = sourceText.match(
    /^(in|on|at|by|with|without|for|to)\s+(.+)$/i,
  );
  if (phraseMatch) {
    const [, preposition, bodyText] = phraseMatch;
    const body = translateEnglishPhraseLocally(bodyText);
    const combined = combinePrepositionalTranslation(preposition, body);
    if (combined) return combined;
  }

  const localPhrase = translateEnglishPhraseLocally(sourceText);
  if (localPhrase && hasCjkChars(localPhrase)) return localPhrase;
  return localPhrase;
}

function isReasonablePartTranslation(_part, translation) {
  const value = sanitizePartTranslation(translation);
  if (!value) return false;
  if (/[\r\n]/.test(value)) return false;
  return true;
}

async function requestDirectPartTranslation(
  base,
  model,
  original,
  translation,
  part,
  runtime,
  trace,
) {
  const prompt = `请把下面这个英文片段翻译成简短自然的简体中文短语，只输出中文结果，不要解释，不要引号。

整句原文：
${getFirstSentence(original)}

整句译文：
${translation || ""}

当前片段：
${part.text}

要求：
1. 只翻译当前片段本身，不要把别的片段意思带进来。
2. 输出必须是中文，不能保留英文单词。
3. 如果是功能词或短语，也要给出最贴切的中文作用义。`;

  try {
    const responseText = await runSentenceStudyCompletionText(
      base,
      model,
      prompt,
      runtime,
      trace,
    );
    const candidate = sanitizePartTranslation(responseText);
    if (!isReasonablePartTranslation(part, candidate)) return "";
    return candidate;
  } catch (_) {
    return "";
  }
}

async function requestPhraseBodyTranslation(
  base,
  model,
  original,
  translation,
  text,
  runtime,
  trace,
) {
  const prompt = `请把下面这个英文名词短语或短语主体翻译成简短自然的简体中文，只输出中文结果，不要解释，不要引号。

整句原文：
${getFirstSentence(original)}

整句译文：
${translation || ""}

短语：
${text}`;

  try {
    const responseText = await runSentenceStudyCompletionText(
      base,
      model,
      prompt,
      runtime,
      trace,
    );
    const candidate = sanitizePartTranslation(responseText);
    if (!candidate) return "";
    return candidate;
  } catch (_) {
    return "";
  }
}

async function requestPartTranslation(
  base,
  model,
  original,
  translation,
  sentenceStudy,
  index,
  runtime,
  trace,
) {
  const part = sentenceStudy.parts[index];
  if (!part) return "";

  const staticTranslation = getStaticPartTranslation(part);
  if (staticTranslation) return staticTranslation;

  const pieces = sentenceStudy.parts.map((item, itemIndex) => ({
    index: itemIndex + 1,
    text: item.text,
    label: item.label,
  }));

  const prompt = `你在帮助中文用户学习英文句子结构。现在只翻译其中一个英文片段，只输出这个片段本身在整句中的简短中文意思，不要吞并别的片段意思。

整句原文：
${getFirstSentence(original)}

整句译文：
${translation || ""}

整句片段（按顺序）：
${JSON.stringify(pieces, null, 2)}

当前片段：
${JSON.stringify(
  {
    index: index + 1,
    text: part.text,
    label: part.label,
    previous: sentenceStudy.parts[index - 1]?.text || "",
    next: sentenceStudy.parts[index + 1]?.text || "",
  },
  null,
  2,
)}

要求：
1. 只输出一个中文短语，不要解释，不要 JSON，不要引号，不要序号。
2. 只能表达当前片段本身的意思，不能把前后片段的意思带进来。
3. 如果当前片段是功能词或系动词，只输出最短作用义，例如 "is" 输出 "是"。
4. 如果当前片段确实不适合单独翻译，输出空字符串。`;

  try {
    const responseText = await runSentenceStudyCompletionText(
      base,
      model,
      prompt,
      runtime,
      trace,
    );
    const candidate = sanitizePartTranslation(responseText);
    if (isReasonablePartTranslation(part, candidate)) return candidate;

    const directCandidate = await requestDirectPartTranslation(
      base,
      model,
      original,
      translation,
      part,
      runtime,
      trace,
    );
    if (directCandidate) return directCandidate;

    const phraseMatch = String(part.text || "")
      .trim()
      .match(/^(in|on|at|by|with|without|for|to)\s+(.+)$/i);
    if (phraseMatch) {
      const [, preposition, bodyText] = phraseMatch;
      const bodyTranslation = await requestPhraseBodyTranslation(
        base,
        model,
        original,
        translation,
        bodyText,
        runtime,
        trace,
      );
      const combined = combinePrepositionalTranslation(
        preposition,
        bodyTranslation,
      );
      if (isReasonablePartTranslation(part, combined)) return combined;
    }

    return "";
  } catch (_) {
    return "";
  }
}

async function requestSentenceStudy(
  base,
  model,
  original,
  prompt,
  runtime,
  trace,
) {
  const responseText = await runSentenceStudyCompletionText(
    base,
    model,
    prompt,
    runtime,
    trace,
  );
  const jsonText = extractJsonObject(responseText);
  if (!jsonText) return null;
  const normalized = finalizeSentenceStudy(
    normalizeSentenceStudy(JSON.parse(jsonText)),
  );
  return repairSentenceStudyCoverage(original, normalized);
}

async function fillSentenceStudyTranslations(
  sentenceStudy,
  fullTranslation = "",
) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts))
    return sentenceStudy;

  function resolvePartTranslationWithoutRequest(part, index) {
    const existingTranslation = sanitizePartTranslation(
      part?.translation || "",
    );
    if (
      isReasonablePartTranslation(part, existingTranslation) &&
      !isLikelyUntranslatedPart(part, existingTranslation)
    ) {
      return existingTranslation;
    }
    const localFallback = buildLocalPartTranslation(
      part,
      fullTranslation,
      index,
    );
    if (localFallback) return localFallback;

    if (isReasonablePartTranslation(part, existingTranslation)) {
      return existingTranslation;
    }
    const sourceText = String(part?.text || "").trim();
    const sourceFallback = sanitizePartTranslation(sourceText);
    if (sourceFallback) return sourceFallback;
    return "";
  }

  const parts = [];

  for (let index = 0; index < sentenceStudy.parts.length; index += 1) {
    const part = sentenceStudy.parts[index];
    parts.push({
      ...part,
      translation: resolvePartTranslationWithoutRequest(part, index),
    });
  }

  return {
    ...sentenceStudy,
    parts,
  };
}

export async function hydrateSentenceStudyTranslations(
  sentenceStudy,
  fullTranslation = "",
) {
  return fillSentenceStudyTranslations(sentenceStudy, fullTranslation);
}

export async function analyzeSentenceStudy(
  base,
  model,
  original,
  translation,
  runtime = {},
) {
  const trace = {
    thinkingSegments: [],
  };
  const text = String(original || "").trim();
  if (!text || text.length > SENTENCE_STUDY_MAX_TEXT_LENGTH) return null;
  // 单个单词不做句型分析
  if (!/\s/.test(text)) return null;
  if (!getFirstSentence(text)) return null;

  const prompt = `请做英文句型学习分析，只输出一个 JSON 对象（不要 markdown，不要解释，不要额外文本）。

如果你是推理模型，请不要输出 <think> 内容，直接给 JSON。

格式：
{
  "pattern": "简短中文句型名",
  "parts": [
    {
      "text": "原文连续片段",
      "translation": "中文短语",
      "label": "主语/系动词/谓语/宾语/表语/状语/从句/定语/补足成分",
      "note": "可为空"
    }
  ]
}

约束：
1. 只分析第一句完整英文句子。
2. parts.text 必须逐字符来自原文，顺序一致，不重叠。
3. 所有 parts.text 拼接后必须完整覆盖目标句，不遗漏单词和标点。
4. 主语不要包含系动词或谓语动词。
5. parts.translation 与 note 用简体中文，尽量短。
6. 每个 parts.translation 必须非空；可保留专有名词英文（如 Next.js、React）。
7. 建议切成 3-8 段。

原文：
${text}

译文：
${translation || ""}`;

  try {
    const sentenceStudy = await requestSentenceStudy(
      base,
      model,
      text,
      prompt,
      runtime,
      trace,
    );
    const fallback = shouldUseHeuristicFallback(sentenceStudy, text)
      ? buildHeuristicSentenceStudy(text)
      : sentenceStudy;
    if (!fallback) return null;
    const finalized = await fillSentenceStudyTranslations(
      fallback,
      translation,
    );
    return attachSentenceStudyThinking(finalized, trace);
  } catch (_) {
    const fallback = buildHeuristicSentenceStudy(text);
    if (!fallback) return null;
    const finalized = await fillSentenceStudyTranslations(
      fallback,
      translation,
    );
    return attachSentenceStudyThinking(finalized, trace);
  }
}
