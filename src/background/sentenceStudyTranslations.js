import {
  extractJsonObject,
  finalizeSentenceStudy,
  normalizeSentenceStudy,
  repairSentenceStudyCoverage,
  sanitizePartTranslation,
  getFirstSentence,
  hasLatinLetters,
  hasCjkChars,
  extractLatinTokens,
} from "./sentenceStudyStructure.js";
import { runSentenceStudyCompletionText } from "./sentenceStudyStreaming.js";

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

function normalizeComparableText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s.,!?;:，。！？；："'`‘’“”\-_/\\()[\]{}]+/g, "")
    .trim();
}

function isLikelyUntranslatedPart(part, translation) {
  const value = sanitizePartTranslation(translation);
  if (!value) return true;
  const source = sanitizePartTranslation(part?.text || "");
  if (source && normalizeComparableText(value) === normalizeComparableText(source)) {
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

const STATIC_TRANSLATIONS = {
  am: "是",
  is: "是",
  are: "是",
  was: "是",
  were: "是",
  be: "是",
  been: "是",
  being: "是",
  this: "这",
  that: "那",
  these: "这些",
  those: "那些",
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
    merged += prevHasLatin && nextHasLatin ? ` ${part}` : part;
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
    if (!mapped && /^(next\.js|react)$/i.test(cleaned)) mapped = cleaned;
    if (!mapped && /^[A-Z][A-Za-z0-9.]*$/.test(cleaned)) mapped = cleaned;
    if (!mapped) mapped = cleaned;
    translated.push(mapped);
  }

  return sanitizePartTranslation(joinLocalizedTokens(translated));
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
  const prefix = String(preposition || "").trim().toLowerCase();
  const body = sanitizePartTranslation(bodyTranslation);
  if (!body) return "";
  if (LOCATIVE_PREPOSITIONS.has(prefix)) {
    return body.endsWith("中") || body.endsWith("内") ? `在${body}` : `在${body}中`;
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

  const phraseMatch = sourceText.match(/^(in|on|at|by|with|without|for|to)\s+(.+)$/i);
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

async function fillSentenceStudyTranslations(sentenceStudy, fullTranslation = "") {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return sentenceStudy;

  function resolvePartTranslationWithoutRequest(part, index) {
    const existingTranslation = sanitizePartTranslation(part?.translation || "");
    if (
      isReasonablePartTranslation(part, existingTranslation) &&
      !isLikelyUntranslatedPart(part, existingTranslation)
    ) {
      return existingTranslation;
    }
    const localFallback = buildLocalPartTranslation(part, fullTranslation, index);
    if (localFallback) return localFallback;
    if (isReasonablePartTranslation(part, existingTranslation)) {
      return existingTranslation;
    }
    const sourceFallback = sanitizePartTranslation(String(part?.text || "").trim());
    return sourceFallback || "";
  }

  return {
    ...sentenceStudy,
    parts: sentenceStudy.parts.map((part, index) => ({
      ...part,
      translation: resolvePartTranslationWithoutRequest(part, index),
    })),
  };
}

export async function hydrateSentenceStudyTranslations(
  sentenceStudy,
  fullTranslation = "",
) {
  return fillSentenceStudyTranslations(sentenceStudy, fullTranslation);
}

export async function requestSentenceStudy(
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
  return repairSentenceStudyCoverage(
    original,
    finalizeSentenceStudy(normalizeSentenceStudy(JSON.parse(jsonText))),
  );
}
