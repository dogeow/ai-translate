/**
 * DogeOW 云端单词同步
 * 本地 known/studying 与 next-api.dogeow.com /api/ai-translate/words 双向合并
 */

import { dogeowAuthedRequest } from "./dogeow-auth.js";
import {
  loadAllWords,
  saveAllWords,
} from "./word-learning.js";
import { INTERVAL_LEVELS, normalizeWord } from "./word-learning.js";

export const DOGEOW_WORD_SYNC_META_KEY = "dogeowWordSyncMeta";

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

function finiteTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function entryActivity(entry) {
  if (!entry || typeof entry !== "object") return 0;
  const times = [
    finiteTimestamp(entry.lastReviewedAt),
    finiteTimestamp(entry.updatedAt),
    finiteTimestamp(entry.addedAt),
  ];
  if (Array.isArray(entry.history)) {
    for (const item of entry.history) {
      times.push(finiteTimestamp(item?.at));
    }
  }
  return Math.max(0, ...times);
}

function normalizeKnownEntry(entry, now) {
  return { addedAt: finiteTimestamp(entry?.addedAt) || now };
}

function normalizeStudyingEntry(entry, now) {
  const rawLevel = Number(entry?.level);
  const level = Number.isFinite(rawLevel)
    ? Math.max(-1, Math.min(INTERVAL_LEVELS.length - 1, Math.trunc(rawLevel)))
    : -1;
  const lastAction =
    entry?.lastAction === "remember" || entry?.lastAction === "forget"
      ? entry.lastAction
      : null;
  const history = Array.isArray(entry?.history)
    ? entry.history
        .map((item) => {
          const action =
            item?.action === "remember" || item?.action === "forget"
              ? item.action
              : null;
          const at = finiteTimestamp(item?.at);
          return action && at ? { at, action } : null;
        })
        .filter(Boolean)
        .slice(-20)
    : [];

  return {
    addedAt: finiteTimestamp(entry?.addedAt) || now,
    level,
    lastReviewedAt: finiteTimestamp(entry?.lastReviewedAt) || null,
    nextReviewAt: finiteTimestamp(entry?.nextReviewAt) || null,
    lastAction,
    history,
  };
}

/**
 * 按单词合并本地与云端，取活动时间更新的一侧；同一单词只保留 known 或 studying。
 */
export function mergeWordSnapshots(local = {}, remote = {}, now = Date.now()) {
  const words = new Set([
    ...Object.keys(local.known || {}),
    ...Object.keys(local.studying || {}),
    ...Object.keys(remote.known || {}),
    ...Object.keys(remote.studying || {}),
  ]);

  const known = {};
  const studying = {};

  for (const raw of words) {
    const word = normalizeWord(raw);
    if (!word) continue;

    const candidates = [];
    const localKnown = local.known?.[raw] || local.known?.[word];
    const localStudying = local.studying?.[raw] || local.studying?.[word];
    const remoteKnown = remote.known?.[raw] || remote.known?.[word];
    const remoteStudying = remote.studying?.[raw] || remote.studying?.[word];

    if (localKnown) candidates.push({ status: "known", entry: localKnown });
    if (localStudying) candidates.push({ status: "studying", entry: localStudying });
    if (remoteKnown) candidates.push({ status: "known", entry: remoteKnown });
    if (remoteStudying) candidates.push({ status: "studying", entry: remoteStudying });

    candidates.sort((a, b) => entryActivity(b.entry) - entryActivity(a.entry));
    const winner = candidates[0];
    if (!winner) continue;

    if (winner.status === "known") {
      known[word] = normalizeKnownEntry(winner.entry, now);
    } else {
      studying[word] = normalizeStudyingEntry(winner.entry, now);
    }
  }

  return { known, studying };
}

export async function getWordSyncMeta() {
  const stored = await getLocal(DOGEOW_WORD_SYNC_META_KEY);
  const meta = stored[DOGEOW_WORD_SYNC_META_KEY];
  return meta && typeof meta === "object" ? meta : {};
}

export async function setWordSyncMeta(meta) {
  await setLocal({ [DOGEOW_WORD_SYNC_META_KEY]: meta || {} });
}

export async function pullCloudWords(options = {}) {
  return dogeowAuthedRequest("/api/ai-translate/words", {
    method: "GET",
    fetchImpl: options.fetchImpl,
  });
}

export async function pushCloudWordsMerge(localWords, options = {}) {
  return dogeowAuthedRequest("/api/ai-translate/words/sync", {
    method: "POST",
    body: {
      known: localWords.known || {},
      studying: localWords.studying || {},
      client_revision: options.clientRevision || 0,
    },
    fetchImpl: options.fetchImpl,
  });
}

export async function replaceCloudWords(localWords, options = {}) {
  return dogeowAuthedRequest("/api/ai-translate/words", {
    method: "PUT",
    body: {
      known: localWords.known || {},
      studying: localWords.studying || {},
    },
    fetchImpl: options.fetchImpl,
  });
}

/**
 * 完整双向同步：本地 ⇄ 云端合并后写回两边。
 */
export async function syncWordsWithCloud(options = {}) {
  const local = await loadAllWords();
  const remotePayload = await pushCloudWordsMerge(local, options);
  const merged = mergeWordSnapshots(local, {
    known: remotePayload?.known || {},
    studying: remotePayload?.studying || {},
  });

  await saveAllWords(merged);
  await setWordSyncMeta({
    revision: Number(remotePayload?.revision) || 0,
    syncedAt: remotePayload?.synced_at || new Date().toISOString(),
    lastSyncAt: Date.now(),
  });

  return {
    known: merged.known,
    studying: merged.studying,
    revision: Number(remotePayload?.revision) || 0,
    syncedAt: remotePayload?.synced_at || null,
    knownCount: Object.keys(merged.known).length,
    studyingCount: Object.keys(merged.studying).length,
  };
}
