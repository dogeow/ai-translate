import {
  TRANSLATION_CACHE_MAX_ENTRIES,
  TRANSLATION_CACHE_STORAGE_KEY,
} from "./constants.js";

function storageLocalGetRaw(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result?.[key]);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageLocalSetRaw(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function normalizeCacheEntry(entry) {
  const original = String(entry?.original || "").trim();
  const translation = String(entry?.translation || "").trim();
  if (!original || !translation) return null;

  const targetLang = String(entry?.targetLang || "").trim();
  const provider = String(entry?.provider || "").trim();
  const model = String(entry?.model || "").trim();
  const triggerSource = String(entry?.triggerSource || "").trim();
  const updatedAt = String(entry?.updatedAt || new Date().toISOString()).trim();

  return {
    id: String(entry?.id || `${original}__${targetLang}__${provider}__${model}`),
    original,
    translation,
    targetLang,
    provider,
    model,
    triggerSource,
    updatedAt,
  };
}

function normalizeCacheList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeCacheEntry)
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function appendTranslationCache(entry) {
  const normalizedEntry = normalizeCacheEntry(entry);
  if (!normalizedEntry) return [];

  const current = normalizeCacheList(
    await storageLocalGetRaw(TRANSLATION_CACHE_STORAGE_KEY),
  );
  const next = [
    normalizedEntry,
    ...current.filter((item) => item.id !== normalizedEntry.id),
  ].slice(0, TRANSLATION_CACHE_MAX_ENTRIES);

  await storageLocalSetRaw({
    [TRANSLATION_CACHE_STORAGE_KEY]: next,
  });

  return next;
}
