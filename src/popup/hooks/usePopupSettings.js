import { useCallback, useEffect, useState } from "react";
import { useTemporaryMessage } from "../../shared/hooks/useTemporaryMessage.js";
import {
  POPUP_SETTINGS_STORAGE_DEFAULTS,
  getPopupSettingsState,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
} from "../../shared/settings.js";

const POPUP_SETTINGS_WATCH_KEYS = new Set([
  "appEnabled",
  "ollamaProvider",
  "minimaxRegion",
  "ollamaAutoTranslateMode",
  "ollamaAutoTranslateSelection",
  "ollamaHoverTranslateScope",
]);

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

  const applyPopupSettingsState = useCallback((value) => {
    const nextState = getPopupSettingsState(value);
    setProvider(nextState.provider);
    setAutoTranslateMode(nextState.autoTranslateMode);
    setHoverTranslateScope(nextState.hoverTranslateScope);
    setAppEnabled(nextState.appEnabled);
  }, []);

  // 初始加载设置
  useEffect(() => {
    chrome.storage.sync.get(
      POPUP_SETTINGS_STORAGE_DEFAULTS,
      applyPopupSettingsState,
    );
  }, [applyPopupSettingsState]);

  // 监听存储变化
  useEffect(() => {
    function handleStorageChanged(changes, areaName) {
      if (areaName !== "sync") return;
      if (!Object.keys(changes).some((key) => POPUP_SETTINGS_WATCH_KEYS.has(key))) {
        return;
      }

      chrome.storage.sync.get(
        POPUP_SETTINGS_STORAGE_DEFAULTS,
        applyPopupSettingsState,
      );
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [applyPopupSettingsState]);

  // 同步设置到存储
  const syncSettings = useCallback((updates) => {
    setIsSaving(true);
    chrome.storage.sync.set(updates, () => {
      setIsSaving(false);
    });
  }, []);

  // 更新提供商
  const updateProvider = useCallback(
    (nextProvider) => {
      const normalized = getPopupSettingsState({
        ollamaProvider: nextProvider,
      }).provider;
      setProvider(normalized);
      syncSettings({ ollamaProvider: normalized });
    },
    [syncSettings],
  );

  // 更新自动翻译模式
  const updateAutoTranslateMode = useCallback(
    (mode) => {
      const normalized = normalizeAutoTranslateMode(mode);
      setAutoTranslateMode(normalized);
      syncSettings({ ollamaAutoTranslateMode: normalized });
    },
    [syncSettings],
  );

  // 更新悬停范围
  const updateHoverTranslateScope = useCallback(
    (scope) => {
      const normalized = normalizeHoverTranslateScope(scope);
      setHoverTranslateScope(normalized);
      syncSettings({ ollamaHoverTranslateScope: normalized });
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
    updateProvider,
    updateAutoTranslateMode,
    updateHoverTranslateScope,
    toggleAppEnabled,
  };
}

/**
 * 管理页面翻译功能的 Hook
 */
export function usePageTranslate(appEnabled) {
  const [isStarting, setIsStarting] = useState(false);
  const { message: status, showMessage: showStatus } =
    useTemporaryMessage(2800);

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

  return {
    isStarting,
    status,
    startPageTranslate,
  };
}
