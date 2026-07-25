const HAN_CHARACTER_RE = /\p{Script=Han}/u;
const JAPANESE_KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SIGNIFICANT_CHARACTER_RE = /[\p{L}\p{N}]/u;
const CHINESE_IDENTIFIER_RE =
  /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\dA-Za-z\-·.]+$/u;

export function isLikelyChineseText(text) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) return false;
  if (JAPANESE_KANA_RE.test(normalizedText)) return false;

  const significantCharacters = Array.from(normalizedText).filter((character) =>
    SIGNIFICANT_CHARACTER_RE.test(character),
  );
  if (significantCharacters.length === 0) return false;

  const hanCharacterCount = significantCharacters.filter((character) =>
    HAN_CHARACTER_RE.test(character),
  ).length;
  if (hanCharacterCount === 0) return false;
  if (
    significantCharacters.length <= 4 &&
    hanCharacterCount === significantCharacters.length
  ) {
    return true;
  }

  return hanCharacterCount / significantCharacters.length >= 0.6;
}

export function isChineseIdentifierText(text) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) return false;
  if (normalizedText.length < 4) return false;
  if (!HAN_CHARACTER_RE.test(normalizedText)) return false;
  if (!/\d/u.test(normalizedText)) return false;
  if (!CHINESE_IDENTIFIER_RE.test(normalizedText)) return false;

  const digitCount = (normalizedText.match(/\d/gu) || []).length;
  return digitCount / normalizedText.length >= 0.3;
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
