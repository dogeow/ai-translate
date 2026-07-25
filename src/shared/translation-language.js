const HAN_CHARACTER_RE = /\p{Script=Han}/u;
const JAPANESE_KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function isLikelyChineseText(text) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) return false;

  return (
    HAN_CHARACTER_RE.test(normalizedText) &&
    !JAPANESE_KANA_RE.test(normalizedText)
  );
}

export function resolveTranslationTargetLang(
  text,
  configuredTargetLang,
  secondaryTargetLang = "English",
) {
  const targetLang = String(configuredTargetLang || "Chinese").trim();

  if (targetLang === "Chinese" && isLikelyChineseText(text)) {
    return secondaryTargetLang;
  }

  return targetLang;
}
