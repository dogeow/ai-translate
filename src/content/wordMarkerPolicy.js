import {
  isStudyingVisibleNow,
  normalizeWord,
} from "../shared/word-learning.js";

export const WORD_MARK_KIND = Object.freeze({
  NONE: "",
  STUDYING: "studying",
  RECOGNITION: "recognition",
});

export function resolveWordMarkKind(
  rawWord,
  {
    knownWords = {},
    studyingWords = {},
    wordMarkingEnabled = false,
    recognitionModeEnabled = false,
    now = Date.now(),
  } = {},
) {
  const word = normalizeWord(rawWord);
  if (!word || knownWords[word]) return WORD_MARK_KIND.NONE;

  const studyingEntry = studyingWords[word];
  if (recognitionModeEnabled) {
    return studyingEntry
      ? WORD_MARK_KIND.STUDYING
      : WORD_MARK_KIND.RECOGNITION;
  }

  if (wordMarkingEnabled && isStudyingVisibleNow(studyingEntry, now)) {
    return WORD_MARK_KIND.STUDYING;
  }
  return WORD_MARK_KIND.NONE;
}

export function isWordMarkerActive({
  wordMarkingEnabled = false,
  recognitionModeEnabled = false,
} = {}) {
  return !!wordMarkingEnabled || !!recognitionModeEnabled;
}

export function shouldPreferWordMarkerCard({
  isMarkedWord = false,
  effectiveScope = "word",
} = {}) {
  return !!isMarkedWord && effectiveScope === "word";
}
