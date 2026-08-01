import {
  INTERVAL_LEVELS,
  formatIntervalShort,
} from "../../../shared/word-learning.js";

export function formatWordLearningDate(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString();
}

export function getWordLearningLevelLabel(entry) {
  const level = entry?.level ?? -1;
  if (level < 0) return "新词";
  return `L${level + 1} · ${formatIntervalShort(INTERVAL_LEVELS[level])}`;
}

export function buildWordLearningList(words, filter = "") {
  const normalizedFilter = filter.trim().toLowerCase();

  return Object.entries(words || {})
    .map(([word, entry]) => ({ word, ...(entry || {}) }))
    .filter(
      ({ word }) =>
        !normalizedFilter || word.toLowerCase().includes(normalizedFilter),
    )
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}
