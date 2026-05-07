/**
 * 英语学习 - background 处理
 * 提供：单词查询（有道）+ 单词增删改 + 复习状态变更 + 右键菜单
 */
import { lookupYoudao } from "../shared/youdao-api.js";
import {
  addKnownWord,
  removeKnownWord,
  addStudyingWord,
  removeStudyingWord,
  reviewStudyingWord,
  loadAllWords,
  loadKnownWords,
  loadStudyingWords,
  normalizeWord,
} from "../shared/word-learning.js";

const youdaoCache = new Map(); // word -> { at, data }
const YOUDAO_CACHE_TTL = 24 * 60 * 60 * 1000;

export async function lookupWordCached(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) {
    return { ok: false, error: "无效的单词。" };
  }
  const cached = youdaoCache.get(word);
  if (cached && Date.now() - cached.at < YOUDAO_CACHE_TTL) {
    return { ok: true, ...cached.data, cached: true };
  }
  try {
    const data = await lookupYoudao(word);
    youdaoCache.set(word, { at: Date.now(), data });
    return { ok: true, ...data };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error) || "查询失败",
    };
  }
}

async function broadcastWordsChanged() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab?.id) continue;
      try {
        chrome.tabs.sendMessage(tab.id, { action: "wordsChanged" }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    }
  } catch (_) {}
}

export async function handleWordLearningMessage(msg) {
  if (msg.action === "lookupWord") {
    return await lookupWordCached(msg.word);
  }
  if (msg.action === "getAllWords") {
    const data = await loadAllWords();
    return { ok: true, ...data };
  }
  if (msg.action === "getKnownWords") {
    const known = await loadKnownWords();
    return { ok: true, words: known };
  }
  if (msg.action === "getStudyingWords") {
    const studying = await loadStudyingWords();
    return { ok: true, words: studying };
  }
  if (msg.action === "addKnownWord") {
    const word = await addKnownWord(msg.word);
    if (word) await broadcastWordsChanged();
    return { ok: !!word, word };
  }
  if (msg.action === "removeKnownWord") {
    const ok = await removeKnownWord(msg.word);
    if (ok) await broadcastWordsChanged();
    return { ok };
  }
  if (msg.action === "addStudyingWord") {
    const word = await addStudyingWord(msg.word);
    if (word) await broadcastWordsChanged();
    return { ok: !!word, word };
  }
  if (msg.action === "removeStudyingWord") {
    const ok = await removeStudyingWord(msg.word);
    if (ok) await broadcastWordsChanged();
    return { ok };
  }
  if (msg.action === "reviewWord") {
    const entry = await reviewStudyingWord(msg.word, msg.reviewAction);
    if (entry) await broadcastWordsChanged();
    return { ok: !!entry, entry };
  }
  return null;
}
