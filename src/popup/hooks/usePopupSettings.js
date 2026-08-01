import { useCallback, useEffect, useState } from "react";
import { useTemporaryMessage } from "../../shared/hooks/useTemporaryMessage.js";
import { detectChromeAiRuntimeAvailability } from "../../shared/chrome-ai-verification.js";
import {
  getDefaultMiniMaxApiUrlByRegion,
  getMiniMaxRegionFromProvider,
  getPopupSettingsState,
  isMiniMaxProvider,
  migrateSettingsIfNeeded,
  normalizeAllSettings,
  normalizeAutoTranslateMode,
  normalizeFeatureProvider,
  normalizeHoverTranslateModifierKey,
  normalizeHoverTranslateScope,
} from "../../shared/settings.js";
import { resolvePageTranslateState } from "../lib/pageTranslateState.js";

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
  const [settings, setSettings] = useState(() => normalizeAllSettings());
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [chromeAiReady, setChromeAiReady] = useState(null);
  const [provider, setProvider] = useState(
    () => getPopupSettingsState().provider,
  );
  const [uiRewriteProvider, setUiRewriteProvider] = useState(
    () => getPopupSettingsState().uiRewriteProvider,
  );
  const [learningProvider, setLearningProvider] = useState(
    () => getPopupSettingsState().learningProvider,
  );
  const [autoTranslateMode, setAutoTranslateMode] = useState(
    () => getPopupSettingsState().autoTranslateMode,
  );
  const [hoverTranslateScope, setHoverTranslateScope] = useState(
    () => getPopupSettingsState().hoverTranslateScope,
  );
  const [hoverTranslateModifierKey, setHoverTranslateModifierKey] = useState(
    () => getPopupSettingsState().hoverTranslateModifierKey,
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
    setSettings(normalizeAllSettings(value));
    setProvider(nextState.provider);
    setUiRewriteProvider(nextState.uiRewriteProvider);
    setLearningProvider(nextState.learningProvider);
    setAutoTranslateMode(nextState.autoTranslateMode);
    setHoverTranslateScope(nextState.hoverTranslateScope);
    setHoverTranslateModifierKey(nextState.hoverTranslateModifierKey);
    setAppEnabled(nextState.appEnabled);
  }, []);

  const reloadPopupSettings = useCallback(async () => {
    const { settings } = await migrateSettingsIfNeeded(
      getAllSyncSettings,
      setAllSyncSettings,
    );
    const chromeAiAvailability =
      await detectChromeAiRuntimeAvailability(settings);
    applyPopupSettingsState(settings);
    setChromeAiReady(
      chromeAiAvailability.checked ? chromeAiAvailability.ready : null,
    );
    setIsSettingsLoaded(true);
  }, [applyPopupSettingsState]);

  // 初始加载设置
  useEffect(() => {
    void reloadPopupSettings();
  }, [reloadPopupSettings]);

  // 监听存储变化
  useEffect(() => {
    function handleStorageChanged(changes, areaName) {
      if (areaName !== "sync") return;
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
      const updates = { provider: normalized };
      if (isMiniMaxProvider(normalized)) {
        const minimaxRegion = getMiniMaxRegionFromProvider(normalized);
        updates.minimaxRegion = minimaxRegion;
        updates.minimaxApiUrl =
          getDefaultMiniMaxApiUrlByRegion(minimaxRegion);
      }
      setProvider(normalized);
      setSettings((previous) =>
        normalizeAllSettings({ ...previous, ...updates }),
      );
      syncSettings(updates);
    },
    [syncSettings],
  );

  const updateUiRewriteProvider = useCallback(
    (nextProvider) => {
      const normalized = normalizeFeatureProvider(nextProvider);
      setUiRewriteProvider(normalized);
      setSettings((previous) =>
        normalizeAllSettings({
          ...previous,
          uiRewriteProvider: normalized,
        }),
      );
      syncSettings({ uiRewriteProvider: normalized });
    },
    [syncSettings],
  );

  const updateLearningProvider = useCallback(
    (nextProvider) => {
      const normalized = normalizeFeatureProvider(nextProvider);
      setLearningProvider(normalized);
      setSettings((previous) =>
        normalizeAllSettings({
          ...previous,
          learningProvider: normalized,
        }),
      );
      syncSettings({ learningProvider: normalized });
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

  const updateHoverTranslateModifierKey = useCallback(
    (modifierKey) => {
      const normalized = normalizeHoverTranslateModifierKey(modifierKey);
      setHoverTranslateModifierKey(normalized);
      syncSettings({ hoverTranslateModifierKey: normalized });
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
    settings,
    isSettingsLoaded,
    chromeAiReady,
    provider,
    uiRewriteProvider,
    learningProvider,
    autoTranslateMode,
    hoverTranslateScope,
    hoverTranslateModifierKey,
    appEnabled,
    isSaving,
    saveStatusText,
    saveStatusIsError,
    updateProvider,
    updateUiRewriteProvider,
    updateLearningProvider,
    updateAutoTranslateMode,
    updateHoverTranslateScope,
    updateHoverTranslateModifierKey,
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
  const [isToggling, setIsToggling] = useState(false);
  const [isChangingDisplayMode, setIsChangingDisplayMode] = useState(false);
  const [isPageTranslateActive, setIsPageTranslateActive] = useState(false);
  const [displayMode, setDisplayMode] = useState("translation");
  const [activeOrigin, setActiveOrigin] = useState("");
  const [siteEnabled, setSiteEnabled] = useState(false);
  const { message: status, showMessage: showStatus } =
    useTemporaryMessage(2800);

  useEffect(() => {
    let cancelled = false;
    let refreshId = 0;

    async function refreshActiveTabState() {
      const requestId = ++refreshId;
      const info = await getActiveTabInfo();
      if (cancelled || requestId !== refreshId) return;
      if (!info) {
        setActiveOrigin("");
        setSiteEnabled(false);
        setIsPageTranslateActive(false);
        setDisplayMode("translation");
        return;
      }
      setActiveOrigin(info.origin);
      setSiteEnabled(false);
      setIsPageTranslateActive(false);
      setDisplayMode("translation");

      chrome.tabs.sendMessage(
        info.tabId,
        { action: "getPageTranslateState" },
        (response) => {
          const lastError = chrome.runtime.lastError;
          if (
            cancelled ||
            requestId !== refreshId ||
            lastError ||
            !response?.ok
          ) {
            return;
          }
          const nextState = resolvePageTranslateState(response, {
            active: false,
            mode: "translation",
          });
          setIsPageTranslateActive(nextState.active);
          setDisplayMode(nextState.mode);
        },
      );

      if (!info.origin) {
        setSiteEnabled(false);
        return;
      }
      const { isAlwaysTranslateOrigin } = await import(
        "../../shared/always-translate-origins.js"
      );
      const enabled = await isAlwaysTranslateOrigin(info.origin);
      if (!cancelled && requestId === refreshId) setSiteEnabled(enabled);
    }

    function handleTabActivated() {
      void refreshActiveTabState();
    }

    function handleTabUpdated(_tabId, changeInfo, tab) {
      if (tab?.active && (changeInfo.url || changeInfo.status === "complete")) {
        void refreshActiveTabState();
      }
    }

    void refreshActiveTabState();
    chrome.tabs.onActivated?.addListener(handleTabActivated);
    chrome.tabs.onUpdated?.addListener(handleTabUpdated);

    return () => {
      cancelled = true;
      chrome.tabs.onActivated?.removeListener(handleTabActivated);
      chrome.tabs.onUpdated?.removeListener(handleTabUpdated);
    };
  }, []);

  const togglePageTranslate = useCallback(() => {
    if (isToggling) return;
    if (!appEnabled) {
      showStatus("应用已关闭，请先开启应用。");
      return;
    }
    const shouldStop = isPageTranslateActive;
    setIsToggling(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        setIsToggling(false);
        showStatus("未找到当前标签页。");
        return;
      }
      chrome.tabs.sendMessage(
        tabId,
        {
          action: shouldStop
            ? "stopVisualPageTranslate"
            : "startVisualPageTranslate",
        },
        (response) => {
          setIsToggling(false);
          if (chrome.runtime.lastError) {
            showStatus("当前页面不支持页面翻译。");
            return;
          }
          if (response?.ok) {
            const nextState = resolvePageTranslateState(response, {
              active: !shouldStop,
              mode: displayMode,
            });
            setIsPageTranslateActive(nextState.active);
            setDisplayMode(nextState.mode);
            showStatus(
              shouldStop
                ? "已停止继续翻译，已完成的译文会保留。"
                : "已启动：先翻译可视区域，滚动后继续。",
            );
            return;
          }
          showStatus(
            shouldStop ? "停止失败，请重试。" : "启动失败，请重试。",
          );
        },
      );
    });
  }, [
    appEnabled,
    displayMode,
    isPageTranslateActive,
    isToggling,
    showStatus,
  ]);

  const changeDisplayMode = useCallback(
    (mode) => {
      if (
        isChangingDisplayMode ||
        !isPageTranslateActive ||
        !["translation", "original", "bilingual"].includes(mode)
      ) {
        return;
      }

      setIsChangingDisplayMode(true);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs?.[0]?.id;
        if (!tabId) {
          setIsChangingDisplayMode(false);
          showStatus("未找到当前标签页。");
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          { action: "setPageTranslateMode", mode },
          (response) => {
            setIsChangingDisplayMode(false);
            if (chrome.runtime.lastError || !response?.ok) {
              setIsPageTranslateActive(false);
              showStatus("当前页面的翻译状态已失效，请重新翻译。");
              return;
            }
            const nextState = resolvePageTranslateState(response, {
              active: isPageTranslateActive,
              mode,
            });
            setIsPageTranslateActive(nextState.active);
            setDisplayMode(nextState.mode);
          },
        );
      });
    },
    [
      isChangingDisplayMode,
      isPageTranslateActive,
      showStatus,
    ],
  );

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
      if (!isPageTranslateActive) togglePageTranslate();
    } else {
      showStatus(`已移出自动翻译：${activeOrigin}`);
    }
  }, [
    appEnabled,
    activeOrigin,
    isPageTranslateActive,
    showStatus,
    togglePageTranslate,
  ]);

  return {
    isToggling,
    isChangingDisplayMode,
    isPageTranslateActive,
    displayMode,
    status,
    togglePageTranslate,
    changeDisplayMode,
    toggleSiteAutoTranslate,
    siteAutoTranslateEnabled: siteEnabled,
    activeOrigin,
  };
}
