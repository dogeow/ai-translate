import { useCallback, useEffect, useRef, useState } from "react";
import { TRANSLATION_CACHE_STORAGE_KEY } from "../../shared/constants.js";
import {
  storageLocalGetValue,
  storageLocalRemove,
  storageOnChanged,
} from "../lib/chrome.js";

const COPY_STATUS_RESET_MS = 1800;

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function normalizeCacheList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      ...entry,
      id: String(entry.id || ""),
      original: normalizeText(entry.original),
      translation: normalizeText(entry.translation),
      targetLang: normalizeText(entry.targetLang),
      provider: normalizeText(entry.provider),
      model: normalizeText(entry.model),
      triggerSource: normalizeText(entry.triggerSource),
      updatedAt: normalizeText(entry.updatedAt),
    }))
    .filter((entry) => entry.id && entry.original && entry.translation)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function formatCacheBlock(entry, index) {
  return [
    `#${index + 1}`,
    `time: ${entry.updatedAt || "-"}`,
    `targetLang: ${entry.targetLang || "-"}`,
    `provider: ${entry.provider || "-"}`,
    `model: ${entry.model || "-"}`,
    `source: ${entry.triggerSource || "-"}`,
    "original:",
    entry.original,
    "translation:",
    entry.translation,
  ].join("\n");
}

export function useTranslationCache() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const copyStatusTimerRef = useRef(null);

  const applyEntries = useCallback((rawEntries) => {
    setEntries(normalizeCacheList(rawEntries));
  }, []);

  const refreshEntries = useCallback(async () => {
    setError("");
    try {
      const raw = await storageLocalGetValue(TRANSLATION_CACHE_STORAGE_KEY, []);
      applyEntries(raw);
    } catch (err) {
      setError(err?.message || "读取缓存失败");
    } finally {
      setLoading(false);
    }
  }, [applyEntries]);

  const clearEntries = useCallback(async () => {
    setError("");
    try {
      await storageLocalRemove(TRANSLATION_CACHE_STORAGE_KEY);
      applyEntries([]);
    } catch (err) {
      setError(err?.message || "清空缓存失败");
    }
  }, [applyEntries]);

  const copyEntries = useCallback(async () => {
    if (!entries.length) {
      setCopyStatus("暂无缓存");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        entries.map(formatCacheBlock).join("\n\n----------------------------------------\n\n"),
      );
      setCopyStatus(`已复制 ${entries.length} 条`);
    } catch (_) {
      setCopyStatus("复制失败");
    }
  }, [entries]);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    const listener = (changes, areaName) => {
      if (areaName !== "local") return;
      if (!(TRANSLATION_CACHE_STORAGE_KEY in changes)) return;
      applyEntries(changes[TRANSLATION_CACHE_STORAGE_KEY]?.newValue || []);
      setLoading(false);
    };
    return storageOnChanged(listener);
  }, [applyEntries]);

  useEffect(() => {
    if (!copyStatus) return undefined;
    window.clearTimeout(copyStatusTimerRef.current);
    copyStatusTimerRef.current = window.setTimeout(
      () => setCopyStatus(""),
      COPY_STATUS_RESET_MS,
    );
    return () => window.clearTimeout(copyStatusTimerRef.current);
  }, [copyStatus]);

  return {
    entries,
    loading,
    error,
    copyStatus,
    refreshEntries,
    clearEntries,
    copyEntries,
  };
}
