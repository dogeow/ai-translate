import { useCallback, useEffect, useRef, useState } from "react";
import { useTransientStatus } from "./useTransientStatus.js";
import {
  getInitialSettings,
  getSettingsSnapshot,
  getStoredSettingsShape,
} from "../lib/utils.js";
import { storageSyncGet, storageSyncSet } from "../lib/chrome.js";
import { migrateSettingsIfNeeded } from "../../shared/settings.js";

/**
 * 管理扩展设置的 hook
 * 提供设置读取、更新、持久化和自动保存功能
 */
export function useSettings() {
  const [settings, setSettings] = useState(() => getInitialSettings());
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
  const loadSettings = useCallback(async () => {
    const { settings: storedSettings } = await migrateSettingsIfNeeded(
      () => storageSyncGet(null),
      (updates) => storageSyncSet(updates),
    );

    const nextSettings = getStoredSettingsShape(storedSettings);
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    lastSavedSettingsRef.current = JSON.stringify(
      getSettingsSnapshot(nextSettings),
    );
    return nextSettings;
  }, []);

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
