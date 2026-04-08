import { useCallback, useEffect, useRef, useState } from "react";
import { useTransientStatus } from "./useTransientStatus.js";
import {
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_API_KEY,
  DEFAULT_MINIMAX_API_KEY_CN,
  DEFAULT_MINIMAX_API_KEY_GLOBAL,
  DEFAULT_MINIMAX_REGION,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_GITHUB_MODELS_API_URL,
  DEFAULT_GITHUB_AUTH_MODE,
  DEFAULT_GITHUB_PAT,
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  DEFAULT_LEARNING_MODE_ENABLED,
} from "../../shared/constants.js";
import { getSettingsSnapshot, getStoredSettingsShape } from "../lib/utils.js";
import { storageSyncGet, storageSyncSet } from "../lib/chrome.js";

const INITIAL_SETTINGS = {
  ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  minimaxApiUrl: DEFAULT_MINIMAX_API_URL,
  minimaxRegion: DEFAULT_MINIMAX_REGION,
  minimaxApiKey: DEFAULT_MINIMAX_API_KEY,
  minimaxApiKeyCn: DEFAULT_MINIMAX_API_KEY_CN,
  minimaxApiKeyGlobal: DEFAULT_MINIMAX_API_KEY_GLOBAL,
  minimaxModel: DEFAULT_MINIMAX_MODEL,
  githubApiUrl: DEFAULT_GITHUB_MODELS_API_URL,
  githubAuthMode: DEFAULT_GITHUB_AUTH_MODE,
  githubPat: DEFAULT_GITHUB_PAT,
  githubDeviceToken: DEFAULT_GITHUB_DEVICE_TOKEN,
  githubOAuthClientId: DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  githubModel: DEFAULT_GITHUB_MODEL,
  translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
  ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
  ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
  ollamaHoverTranslateDelayMs: String(DEFAULT_HOVER_TRANSLATE_DELAY_MS),
  ollamaPageTranslateConcurrency: String(DEFAULT_PAGE_TRANSLATE_CONCURRENCY),
  ollamaPageTranslateBatchChars: String(DEFAULT_PAGE_TRANSLATE_BATCH_CHARS),
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
};

/**
 * 管理扩展设置的 hook
 * 提供设置读取、更新、持久化和自动保存功能
 */
export function useSettings() {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const { status: autoSaveStatus, showStatus: showAutoSaveStatus } =
    useTransientStatus();
  const settingsRef = useRef(settings);
  const lastSavedSettingsRef = useRef("");
  const autoSaveTimerRef = useRef(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    return () => {
      window.clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const persistSettings = useCallback(
    async (nextSettings, options = {}) => {
      const { force = false, silent = false } = options;
      const snapshot = getSettingsSnapshot(nextSettings);
      const serialized = JSON.stringify(snapshot);
      if (!force && serialized === lastSavedSettingsRef.current) {
        return snapshot;
      }
      await storageSyncSet(snapshot);
      lastSavedSettingsRef.current = serialized;
      if (!silent) showAutoSaveStatus("已自动保存");
      return snapshot;
    },
    [showAutoSaveStatus],
  );

  const scheduleSettingsSave = useCallback(
    (nextSettings, delay = 500) => {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = window.setTimeout(() => {
        void persistSettings(nextSettings).catch((error) => {
          console.error("Auto save settings failed:", error);
          showAutoSaveStatus("自动保存失败", true);
        });
      }, delay);
    },
    [persistSettings, showAutoSaveStatus],
  );

  const updateSettings = useCallback(
    (partial, persistMode = "none", options = {}) => {
      setSettings((previous) => {
        const next =
          typeof partial === "function"
            ? partial(previous)
            : { ...previous, ...partial };
        settingsRef.current = next;
        if (persistMode === "now") {
          void persistSettings(next, options).catch((error) => {
            console.error("Save settings failed:", error);
            showAutoSaveStatus("自动保存失败", true);
          });
        } else if (persistMode === "debounced") {
          scheduleSettingsSave(next, options.delay);
        }
        return next;
      });
    },
    [persistSettings, scheduleSettingsSave, showAutoSaveStatus],
  );

  /**
   * 从 chrome.storage.sync 加载设置
   * @returns {Promise<object>} 加载后的设置
   */
  async function loadSettings() {
    const storedSettings = await storageSyncGet({
      ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
      ollamaUrl: DEFAULT_OLLAMA_URL,
      ollamaModel: DEFAULT_OLLAMA_MODEL,
      minimaxApiUrl: DEFAULT_MINIMAX_API_URL,
      minimaxRegion: DEFAULT_MINIMAX_REGION,
      minimaxApiKey: DEFAULT_MINIMAX_API_KEY,
      minimaxApiKeyCn: DEFAULT_MINIMAX_API_KEY_CN,
      minimaxApiKeyGlobal: DEFAULT_MINIMAX_API_KEY_GLOBAL,
      minimaxModel: DEFAULT_MINIMAX_MODEL,
      githubApiUrl: DEFAULT_GITHUB_MODELS_API_URL,
      githubAuthMode: DEFAULT_GITHUB_AUTH_MODE,
      githubPat: DEFAULT_GITHUB_PAT,
      githubDeviceToken: DEFAULT_GITHUB_DEVICE_TOKEN,
      githubOAuthClientId: DEFAULT_GITHUB_OAUTH_CLIENT_ID,
      githubModel: DEFAULT_GITHUB_MODEL,
      translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
      ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
      ollamaAutoTranslateSelection: false,
      ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
      ollamaHoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
      ollamaPageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
      ollamaPageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
      learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
    });

    const nextSettings = getStoredSettingsShape(storedSettings);
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    lastSavedSettingsRef.current = JSON.stringify(
      getSettingsSnapshot(nextSettings),
    );
    return nextSettings;
  }

  return {
    settings,
    settingsRef,
    autoSaveStatus,
    showAutoSaveStatus,
    persistSettings,
    updateSettings,
    loadSettings,
  };
}
