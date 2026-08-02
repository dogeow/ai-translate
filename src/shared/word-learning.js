/**
 * 英语学习 - 单词存储与间隔复习算法
 * 数据存于 chrome.storage.local。
 *
 * 存储键：
 *   knownWords     -> { [word]: { addedAt: number } }
 *   studyingWords  -> {
 *     [word]: {
 *       addedAt: number,
 *       level: number,                 // -1 = 未复习；0..N = 间隔等级
 *       lastReviewedAt: number | null,
 *       nextReviewAt: number | null,   // 在此时间之前不显示标记
 *       lastAction: "remember" | "forget" | null,
 *       history: [{ at, action }]
 *     }
 *   }
 *
 * 调度规则：
 *   等级序列 INTERVAL_LEVELS = [1h, 4h, 16h, 64h, 256h, 1024h]
 *   - 新词刚标记：level = -1，nextReviewAt = null（持续显示）
 *   - 用户在卡片上点 "记得"：level = max(0, level) + 1（首次封顶 0），
 *     之后 nextReviewAt = now + INTERVAL_LEVELS[level]
 *     即首次记得 -> 1h；再次记得 -> 4h；再 -> 16h…
 *   - 用户点 "忘记"：level = max(0, level - 1)，nextReviewAt = now + INTERVAL_LEVELS[level]
 *   - 加入"我知道的单词"：从 studyingWords 移除，写入 knownWords。
 */

export const KNOWN_WORDS_STORAGE_KEY = "knownWords";
export const STUDYING_WORDS_STORAGE_KEY = "studyingWords";
export const WORD_MARKING_ENABLED_KEY = "wordMarkingEnabled";
export const WORD_RECOGNITION_MODE_ENABLED_KEY = "wordRecognitionModeEnabled";

const HOUR = 60 * 60 * 1000;
export const INTERVAL_LEVELS = [
  1 * HOUR,
  4 * HOUR,
  16 * HOUR,
  64 * HOUR,
  256 * HOUR,
  1024 * HOUR,
];

export function normalizeWord(raw) {
  if (!raw) return "";
  const text = String(raw).trim().toLowerCase();
  // 仅允许英文字母 / 连字符 / 撇号；过滤纯数字/符号
  if (!/^[a-z][a-z'\-]*$/i.test(text)) return "";
  if (text.length < 2 && text !== "a" && text !== "i") return "";
  return text;
}

function getLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (value) => resolve(value || {}));
  });
}

function setLocal(updates) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export async function loadKnownWords() {
  const stored = await getLocal(KNOWN_WORDS_STORAGE_KEY);
  const value = stored[KNOWN_WORDS_STORAGE_KEY];
  return value && typeof value === "object" ? value : {};
}

export async function loadStudyingWords() {
  const stored = await getLocal(STUDYING_WORDS_STORAGE_KEY);
  const value = stored[STUDYING_WORDS_STORAGE_KEY];
  return value && typeof value === "object" ? value : {};
}

export async function saveKnownWords(words) {
  await setLocal({ [KNOWN_WORDS_STORAGE_KEY]: words || {} });
}

export async function saveStudyingWords(words) {
  await setLocal({ [STUDYING_WORDS_STORAGE_KEY]: words || {} });
}

export async function saveAllWords({ known = {}, studying = {} } = {}) {
  await setLocal({
    [KNOWN_WORDS_STORAGE_KEY]: known,
    [STUDYING_WORDS_STORAGE_KEY]: studying,
  });
}

export async function loadAllWords() {
  const stored = await getLocal([
    KNOWN_WORDS_STORAGE_KEY,
    STUDYING_WORDS_STORAGE_KEY,
  ]);
  return {
    known:
      stored[KNOWN_WORDS_STORAGE_KEY] &&
      typeof stored[KNOWN_WORDS_STORAGE_KEY] === "object"
        ? stored[KNOWN_WORDS_STORAGE_KEY]
        : {},
    studying:
      stored[STUDYING_WORDS_STORAGE_KEY] &&
      typeof stored[STUDYING_WORDS_STORAGE_KEY] === "object"
        ? stored[STUDYING_WORDS_STORAGE_KEY]
        : {},
  };
}

export function resolveWordLearningStatus(rawWord, known, studying) {
  const word = normalizeWord(rawWord);
  if (!word) return "unmarked";
  if (known?.[word]) return "known";
  if (studying?.[word]) return "studying";
  return "unmarked";
}

export async function getWordLearningStatus(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return null;
  const { known, studying } = await loadAllWords();
  return {
    word,
    status: resolveWordLearningStatus(word, known, studying),
  };
}

export async function setWordLearningStatus(rawWord, status) {
  const word = normalizeWord(rawWord);
  if (!word || (status !== "known" && status !== "studying")) return null;

  const { known, studying } = await loadAllWords();
  const now = Date.now();

  if (status === "known") {
    known[word] = { addedAt: known[word]?.addedAt || now };
    delete studying[word];
  } else {
    delete known[word];
    studying[word] = studying[word] || {
      addedAt: now,
      level: -1,
      lastReviewedAt: null,
      nextReviewAt: null,
      lastAction: null,
      history: [],
    };
  }

  await setLocal({
    [KNOWN_WORDS_STORAGE_KEY]: known,
    [STUDYING_WORDS_STORAGE_KEY]: studying,
  });
  return { word, status };
}

export async function addKnownWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return null;
  const { known, studying } = await loadAllWords();
  known[word] = { addedAt: known[word]?.addedAt || Date.now() };
  if (studying[word]) {
    delete studying[word];
    await saveStudyingWords(studying);
  }
  await saveKnownWords(known);
  return word;
}

export async function removeKnownWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return false;
  const known = await loadKnownWords();
  if (!(word in known)) return false;
  delete known[word];
  await saveKnownWords(known);
  return true;
}

export async function addStudyingWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return null;
  const { known, studying } = await loadAllWords();
  if (known[word]) return null; // 已知词不再标记
  if (studying[word]) return word;
  studying[word] = {
    addedAt: Date.now(),
    level: -1,
    lastReviewedAt: null,
    nextReviewAt: null,
    lastAction: null,
    history: [],
  };
  await saveStudyingWords(studying);
  return word;
}

export async function removeStudyingWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return false;
  const studying = await loadStudyingWords();
  if (!(word in studying)) return false;
  delete studying[word];
  await saveStudyingWords(studying);
  return true;
}

function nextLevelOnRemember(prevLevel) {
  if (prevLevel < 0) return 0;
  return Math.min(INTERVAL_LEVELS.length - 1, prevLevel + 1);
}

function nextLevelOnForget(prevLevel) {
  if (prevLevel <= 0) return 0;
  return Math.max(0, prevLevel - 1);
}

export async function reviewStudyingWord(rawWord, action) {
  const word = normalizeWord(rawWord);
  if (!word) return null;
  if (action !== "remember" && action !== "forget") return null;
  const studying = await loadStudyingWords();
  const entry = studying[word];
  if (!entry) return null;
  const now = Date.now();
  const prevLevel = typeof entry.level === "number" ? entry.level : -1;
  const nextLevel =
    action === "remember"
      ? nextLevelOnRemember(prevLevel)
      : nextLevelOnForget(prevLevel);
  const intervalMs =
    INTERVAL_LEVELS[nextLevel] || INTERVAL_LEVELS[INTERVAL_LEVELS.length - 1];
  studying[word] = {
    ...entry,
    level: nextLevel,
    lastReviewedAt: now,
    nextReviewAt: now + intervalMs,
    lastAction: action,
    history: [...(entry.history || []).slice(-19), { at: now, action }],
  };
  await saveStudyingWords(studying);
  return studying[word];
}

/** 当前是否应在网页上对该词显示生词标记 */
export function isStudyingVisibleNow(entry, now = Date.now()) {
  if (!entry) return false;
  if (!entry.nextReviewAt) return true;
  return now >= entry.nextReviewAt;
}

/** 计算复习队列：当前可见 + 未来即将到来 */
export function buildReviewSummary(studyingMap, now = Date.now()) {
  const due = [];
  const upcoming = [];
  for (const [word, entry] of Object.entries(studyingMap || {})) {
    if (!entry) continue;
    if (isStudyingVisibleNow(entry, now)) {
      due.push({ word, ...entry });
    } else {
      upcoming.push({ word, ...entry });
    }
  }
  due.sort((a, b) => (a.lastReviewedAt || 0) - (b.lastReviewedAt || 0));
  upcoming.sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0));
  return { due, upcoming };
}

export function formatIntervalShort(ms) {
  if (!ms || ms <= 0) return "立即";
  const h = Math.round(ms / HOUR);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
