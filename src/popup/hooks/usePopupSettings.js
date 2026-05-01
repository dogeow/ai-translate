import { useCallback, useEffect, useState } from "react";
import { useTemporaryMessage } from "../../shared/hooks/useTemporaryMessage.js";
import {
  getPopupSettingsState,
  migrateSettingsIfNeeded,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
} from "../../shared/settings.js";

const POPUP_SETTINGS_WATCH_KEYS = new Set([
  "appEnabled",
  "provider",
  "ollamaProvider",
  "minimaxRegion",
  "autoTranslateMode",
  "ollamaAutoTranslateMode",
  "ollamaAutoTranslateSelection",
  "hoverTranslateScope",
  "ollamaHoverTranslateScope",
]);

function getAllSyncSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, resolve);
  });
}

function setAllSyncSettings(updates) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(updates, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/**
 * 管理弹出窗口设置的自定义 Hook
 * 处理设置的读取、更新和同步
 */
export function usePopupSettings() {
  const [provider, setProvider] = useState(
    () => getPopupSettingsState().provider,
  );
  const [autoTranslateMode, setAutoTranslateMode] = useState(
    () => getPopupSettingsState().autoTranslateMode,
  );
  const [hoverTranslateScope, setHoverTranslateScope] = useState(
    () => getPopupSettingsState().hoverTranslateScope,
  );
  const [appEnabled, setAppEnabled] = useState(
    () => getPopupSettingsState().appEnabled,
  );
  const [isSaving, setIsSaving] = useState(false);
  const {
    message: saveStatusText,
    isError: saveStatusIsError,
    showSuccess,
    showError,
  } = useTemporaryMessage(1400);

  const applyPopupSettingsState = useCallback((value) => {
    const nextState = getPopupSettingsState(value);
    setProvider(nextState.provider);
    setAutoTranslateMode(nextState.autoTranslateMode);
    setHoverTranslateScope(nextState.hoverTranslateScope);
    setAppEnabled(nextState.appEnabled);
  }, []);

  const reloadPopupSettings = useCallback(async () => {
    const { settings } = await migrateSettingsIfNeeded(
      getAllSyncSettings,
      setAllSyncSettings,
    );
    applyPopupSettingsState(settings);
  }, [applyPopupSettingsState]);

  // 初始加载设置
  useEffect(() => {
    void reloadPopupSettings();
  }, [reloadPopupSettings]);

  // 监听存储变化
  useEffect(() => {
    function handleStorageChanged(changes, areaName) {
      if (areaName !== "sync") return;
      if (!Object.keys(changes).some((key) => POPUP_SETTINGS_WATCH_KEYS.has(key))) {
        return;
      }

      void reloadPopupSettings();
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [reloadPopupSettings]);

  // 同步设置到存储
  const syncSettings = useCallback((updates) => {
    setIsSaving(true);
    chrome.storage.sync.set(updates, () => {
      setIsSaving(false);
      if (chrome.runtime.lastError) {
        console.error("Save popup settings failed:", chrome.runtime.lastError);
        showError("保存失败");
        void reloadPopupSettings();
        return;
      }
      showSuccess("已保存", 900);
    });
  }, [reloadPopupSettings, showError, showSuccess]);

  // 更新提供商
  const updateProvider = useCallback(
    (nextProvider) => {
      const normalized = getPopupSettingsState({
        provider: nextProvider,
      }).provider;
      setProvider(normalized);
      syncSettings({ provider: normalized });
    },
    [syncSettings],
  );

  // 更新自动翻译模式
  const updateAutoTranslateMode = useCallback(
    (mode) => {
      const normalized = normalizeAutoTranslateMode(mode);
      setAutoTranslateMode(normalized);
      syncSettings({ autoTranslateMode: normalized });
    },
    [syncSettings],
  );

  // 更新悬停范围
  const updateHoverTranslateScope = useCallback(
    (scope) => {
      const normalized = normalizeHoverTranslateScope(scope);
      setHoverTranslateScope(normalized);
      syncSettings({ hoverTranslateScope: normalized });
    },
    [syncSettings],
  );

  // 切换应用开关
  const toggleAppEnabled = useCallback(() => {
    setAppEnabled((prevEnabled) => {
      const nextEnabled = !prevEnabled;
      syncSettings({ appEnabled: nextEnabled });
      return nextEnabled;
    });
  }, [syncSettings]);

  return {
    provider,
    autoTranslateMode,
    hoverTranslateScope,
    appEnabled,
    isSaving,
    saveStatusText,
    saveStatusIsError,
    updateProvider,
    updateAutoTranslateMode,
    updateHoverTranslateScope,
    toggleAppEnabled,
  };
}

function getActiveTabInfo() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (!tab?.id) {
          resolve(null);
          return;
        }
        let origin = "";
        try {
          const url = new URL(tab.url || "");
          if (/^https?:$/.test(url.protocol)) {
            origin = `${url.protocol}//${url.host}`;
          }
        } catch (_) {}
        resolve({ tabId: tab.id, origin });
      });
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * 管理页面翻译功能的 Hook
 */
export function usePageTranslate(appEnabled) {
  const [isStarting, setIsStarting] = useState(false);
  const [activeOrigin, setActiveOrigin] = useState("");
  const [siteEnabled, setSiteEnabled] = useState(false);
  const { message: status, showMessage: showStatus } =
    useTemporaryMessage(2800);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const info = await getActiveTabInfo();
      if (cancelled || !info) return;
      setActiveOrigin(info.origin);
      if (!info.origin) {
        setSiteEnabled(false);
        return;
      }
      const { isAlwaysTranslateOrigin } = await import(
        "../../shared/always-translate-origins.js"
      );
      const enabled = await isAlwaysTranslateOrigin(info.origin);
      if (!cancelled) setSiteEnabled(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startPageTranslate = useCallback(() => {
    if (isStarting) return;
    if (!appEnabled) {
      showStatus("应用已关闭，请先开启应用。");
      return;
    }
    setIsStarting(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        setIsStarting(false);
        showStatus("未找到当前标签页。");
        return;
      }
      chrome.tabs.sendMessage(
        tabId,
        { action: "startVisualPageTranslate" },
        (response) => {
          setIsStarting(false);
          if (chrome.runtime.lastError) {
            showStatus("当前页面不支持页面翻译。");
            return;
          }
          if (response?.ok) {
            showStatus("已启动：先翻译可视区域，滚动后继续。");
            return;
          }
          showStatus("启动失败，请重试。");
        },
      );
    });
  }, [appEnabled, isStarting, showStatus]);

  const toggleSiteAutoTranslate = useCallback(async () => {
    if (!appEnabled) {
      showStatus("应用已关闭，请先开启应用。");
      return;
    }
    if (!activeOrigin) {
      showStatus("当前页面不支持自动翻译（仅 http/https）。");
      return;
    }
    const { toggleAlwaysTranslateOrigin } = await import(
      "../../shared/always-translate-origins.js"
    );
    const result = await toggleAlwaysTranslateOrigin(activeOrigin);
    if (!result.ok) {
      showStatus("操作失败，请重试。");
      return;
    }
    setSiteEnabled(result.enabled);
    if (result.enabled) {
      showStatus(`已加入自动翻译：${activeOrigin}`);
      // 同时立即翻译当前页
      startPageTranslate();
    } else {
      showStatus(`已移出自动翻译：${activeOrigin}`);
    }
  }, [appEnabled, activeOrigin, showStatus, startPageTranslate]);

  return {
    isStarting,
    status,
    startPageTranslate,
    toggleSiteAutoTranslate,
    siteAutoTranslateEnabled: siteEnabled,
    activeOrigin,
  };
}
