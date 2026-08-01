export const WORD_LEARNING_STATUS = Object.freeze({
  UNMARKED: "unmarked",
  STUDYING: "studying",
  KNOWN: "known",
});

const SINGLE_ENGLISH_WORD_PATTERN =
  /^[\s“”"'‘’()[\]{}.,!?;:…]*([A-Za-z]+(?:['’-][A-Za-z]+)*)[\s“”"'‘’()[\]{}.,!?;:…]*$/;

export function getSingleEnglishWord(text) {
  const match = String(text || "").match(SINGLE_ENGLISH_WORD_PATTERN);
  if (!match) return "";
  return match[1].replaceAll("’", "'").toLowerCase();
}

export function resolveWordLearningShortcut(event) {
  if (
    !event?.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat
  ) {
    return null;
  }
  if (event.code === "Digit1") return WORD_LEARNING_STATUS.STUDYING;
  if (event.code === "Digit2") return WORD_LEARNING_STATUS.KNOWN;
  return null;
}

export function isEditableShortcutTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tagName = String(target.tagName || "").toUpperCase();
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    !!target.isContentEditable
  );
}
