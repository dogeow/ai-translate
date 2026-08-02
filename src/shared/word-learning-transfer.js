import { INTERVAL_LEVELS, normalizeWord } from "./word-learning.js";

export const WORD_LEARNING_EXPORT_FORMAT = "english-learning-ai-translate";
export const WORD_LEARNING_EXPORT_VERSION = 1;
export const WORD_LEARNING_IMPORT_LIMIT = 20000;

const VALID_SCOPES = new Set(["all", "studying", "known"]);
const VALID_REVIEW_ACTIONS = new Set(["remember", "forget"]);

function finiteTimestamp(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeKnownEntry(entry, now) {
  return {
    addedAt: finiteTimestamp(entry?.addedAt, now),
  };
}

function normalizeStudyingEntry(entry, now) {
  const rawLevel = Number(entry?.level);
  const level = Number.isFinite(rawLevel)
    ? Math.max(-1, Math.min(INTERVAL_LEVELS.length - 1, Math.trunc(rawLevel)))
    : -1;
  const lastAction = VALID_REVIEW_ACTIONS.has(entry?.lastAction)
    ? entry.lastAction
    : null;
  const history = Array.isArray(entry?.history)
    ? entry.history
        .map((item) => {
          const action = VALID_REVIEW_ACTIONS.has(item?.action)
            ? item.action
            : null;
          const at = finiteTimestamp(item?.at);
          return action && at ? { at, action } : null;
        })
        .filter(Boolean)
        .slice(-20)
    : [];

  return {
    addedAt: finiteTimestamp(entry?.addedAt, now),
    level,
    lastReviewedAt: finiteTimestamp(entry?.lastReviewedAt),
    nextReviewAt: finiteTimestamp(entry?.nextReviewAt),
    lastAction,
    history,
  };
}

function entriesFromCollection(collection) {
  if (Array.isArray(collection)) {
    return collection.map((item) =>
      typeof item === "string" ? [item, {}] : [item?.word, item],
    );
  }
  if (collection && typeof collection === "object") {
    return Object.entries(collection);
  }
  return [];
}

function sortedExportEntries(words, normalizeEntry, now) {
  return Object.entries(words || {})
    .map(([rawWord, entry]) => {
      const word = normalizeWord(rawWord);
      return word ? { word, ...normalizeEntry(entry, now) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.word.localeCompare(b.word, "en"));
}

export function buildWordLearningExport(
  { known = {}, studying = {} } = {},
  scope = "all",
  now = Date.now(),
) {
  const safeScope = VALID_SCOPES.has(scope) ? scope : "all";
  return {
    format: WORD_LEARNING_EXPORT_FORMAT,
    version: WORD_LEARNING_EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    scope: safeScope,
    studying:
      safeScope === "known"
        ? []
        : sortedExportEntries(studying, normalizeStudyingEntry, now),
    known:
      safeScope === "studying"
        ? []
        : sortedExportEntries(known, normalizeKnownEntry, now),
  };
}

function parseTextList(text) {
  const words = text
    .split(/[\n,;\t]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  return words.length ? { studying: words, known: [] } : null;
}

function decodeImportInput(input) {
  if (typeof input !== "string") return input;
  const text = input.trim();
  if (!text) throw new Error("empty_file");
  try {
    return JSON.parse(text);
  } catch (_) {
    const textList = parseTextList(text);
    if (textList) return textList;
    throw new Error("invalid_file");
  }
}

export function parseWordLearningImport(input, now = Date.now()) {
  const decoded = decodeImportInput(input);
  if (Array.isArray(decoded)) {
    return parseWordLearningImport({ studying: decoded, known: [] }, now);
  }
  if (!decoded || typeof decoded !== "object") {
    throw new Error("invalid_file");
  }
  if (
    decoded.format &&
    (decoded.format !== WORD_LEARNING_EXPORT_FORMAT ||
      Number(decoded.version) !== WORD_LEARNING_EXPORT_VERSION)
  ) {
    throw new Error("unsupported_format");
  }

  const knownInput = decoded.known ?? decoded.knownWords;
  const studyingInput = decoded.studying ?? decoded.studyingWords;
  if (knownInput == null && studyingInput == null) {
    throw new Error("invalid_file");
  }

  const knownEntries = entriesFromCollection(knownInput);
  const studyingEntries = entriesFromCollection(studyingInput);
  if (knownEntries.length + studyingEntries.length > WORD_LEARNING_IMPORT_LIMIT) {
    throw new Error("too_many_words");
  }

  const known = {};
  const studying = {};
  let skipped = 0;

  for (const [rawWord, entry] of studyingEntries) {
    const word = normalizeWord(rawWord);
    if (!word || studying[word]) {
      skipped += 1;
      continue;
    }
    studying[word] = normalizeStudyingEntry(entry, now);
  }

  for (const [rawWord, entry] of knownEntries) {
    const word = normalizeWord(rawWord);
    if (!word || known[word]) {
      skipped += 1;
      continue;
    }
    if (studying[word]) {
      delete studying[word];
      skipped += 1;
    }
    known[word] = normalizeKnownEntry(entry, now);
  }

  if (!Object.keys(known).length && !Object.keys(studying).length) {
    throw new Error("no_valid_words");
  }

  return { known, studying, skipped };
}

export function mergeWordLearningData(
  { known = {}, studying = {} } = {},
  imported = {},
) {
  const nextKnown = { ...known };
  const nextStudying = { ...studying };
  const existingWords = new Set([
    ...Object.keys(nextKnown),
    ...Object.keys(nextStudying),
  ]);
  let addedKnown = 0;
  let addedStudying = 0;
  let skipped = Number(imported.skipped) || 0;

  for (const [word, entry] of Object.entries(imported.studying || {})) {
    if (existingWords.has(word)) {
      skipped += 1;
      continue;
    }
    nextStudying[word] = entry;
    existingWords.add(word);
    addedStudying += 1;
  }

  for (const [word, entry] of Object.entries(imported.known || {})) {
    if (existingWords.has(word)) {
      skipped += 1;
      continue;
    }
    nextKnown[word] = entry;
    existingWords.add(word);
    addedKnown += 1;
  }

  return {
    known: nextKnown,
    studying: nextStudying,
    addedKnown,
    addedStudying,
    skipped,
  };
}
