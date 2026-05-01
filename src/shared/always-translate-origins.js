/**
 * 「翻译该网站」白名单：origin 级别的自动翻译。
 *
 * 存储在 chrome.storage.sync 中，key 为 ALWAYS_TRANSLATE_ORIGINS_KEY，
 * 值为字符串数组（origin 形式：scheme + "//" + host + 可选端口）。
 *
 * Content script 加载后会检查当前 origin 是否在列表中；命中则自动启动整页翻译。
 */
import { ALWAYS_TRANSLATE_ORIGINS_KEY } from "./constants.js";

export function normalizeOrigin(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    return `${url.protocol}//${url.host}`;
  } catch (_) {
    return "";
  }
}

function readOriginsFromStorage() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get([ALWAYS_TRANSLATE_ORIGINS_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          resolve([]);
          return;
        }
        const value = result?.[ALWAYS_TRANSLATE_ORIGINS_KEY];
        resolve(Array.isArray(value) ? value : []);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

function writeOriginsToStorage(origins) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(
        { [ALWAYS_TRANSLATE_ORIGINS_KEY]: origins },
        () => {
          void chrome.runtime?.lastError;
          resolve();
        },
      );
    } catch (_) {
      resolve();
    }
  });
}

export async function getAlwaysTranslateOrigins() {
  const list = await readOriginsFromStorage();
  return list.filter((item) => typeof item === "string" && item);
}

export async function isAlwaysTranslateOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const list = await getAlwaysTranslateOrigins();
  return list.includes(normalized);
}

export async function addAlwaysTranslateOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const list = await getAlwaysTranslateOrigins();
  if (list.includes(normalized)) return true;
  await writeOriginsToStorage([...list, normalized]);
  return true;
}

export async function removeAlwaysTranslateOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const list = await getAlwaysTranslateOrigins();
  if (!list.includes(normalized)) return true;
  await writeOriginsToStorage(list.filter((item) => item !== normalized));
  return true;
}

export async function toggleAlwaysTranslateOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return { ok: false, enabled: false };
  const list = await getAlwaysTranslateOrigins();
  if (list.includes(normalized)) {
    await writeOriginsToStorage(list.filter((item) => item !== normalized));
    return { ok: true, enabled: false, origin: normalized };
  }
  await writeOriginsToStorage([...list, normalized]);
  return { ok: true, enabled: true, origin: normalized };
}
