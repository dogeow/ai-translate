import { WORD_LOOKUP_PROVIDER_YOUDAO } from "./constants.js";

export const YOUDAO_WORD_SOURCE_LABEL = "有道词典";

function normalizeComparedWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'");
}

export function isUsableYoudaoWordResult(requestedWord, result) {
  const requested = normalizeComparedWord(requestedWord);
  const returned = normalizeComparedWord(result?.responseWord);
  return (
    !!requested &&
    requested === returned &&
    Array.isArray(result?.translations) &&
    result.translations.some((translation) => String(translation || "").trim())
  );
}

export function buildAiWordDefinitionPrompt(word) {
  return `请为英语学习者提供单词“${word}”的简明中文释义。
每行只写一个词性和对应中文释义，最多 5 行。
格式示例：adj. 文化的；与文化有关的
不要例句、音标、Markdown、思考过程或额外说明。`;
}

export function parseAiWordTranslations(rawText) {
  return String(rawText || "")
    .replace(/^```[^\n]*\n?/i, "")
    .replace(/```$/i, "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*•]|\d+[.)])\s*/, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 5);
}

export function resolveWordLookupAiProvider(settings = {}) {
  return settings.wordLookupProvider === WORD_LOOKUP_PROVIDER_YOUDAO
    ? settings.learningProvider
    : settings.wordLookupProvider;
}

export function formatWordTranslations(translations) {
  return (Array.isArray(translations) ? translations : [])
    .map((translation) => String(translation || "").trim())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");
}
