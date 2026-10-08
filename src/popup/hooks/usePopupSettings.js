import { useCallback, useEffect, useRef, useState } from "react";
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
  normalizeWordLookupProvider,
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
  const [wordLookupProvider, setWordLookupProvider] = useState(
    () => getPopupSettingsState().wordLookupProvider,
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
  const [learningModeEnabled, setLearningModeEnabled] = useState(
    () => getPopupSettingsState().learningModeEnabled,
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
    setWordLookupProvider(nextState.wordLookupProvider);
    setAutoTranslateMode(nextState.autoTranslateMode);
    setHoverTranslateScope(nextState.hoverTranslateScope);
    setHoverTranslateModifierKey(nextState.hoverTranslateModifierKey);
    setLearningModeEnabled(nextState.learningModeEnabled);
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

  const updateWordLookupProvider = useCallback(
    (nextProvider) => {
      const normalized = normalizeWordLookupProvider(nextProvider);
      setWordLookupProvider(normalized);
      setSettings((previous) =>
        normalizeAllSettings({
          ...previous,
          wordLookupProvider: normalized,
        }),
      );
      syncSettings({ wordLookupProvider: normalized });
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

  const toggleLearningModeEnabled = useCallback(() => {
    setLearningModeEnabled((previous) => {
      const next = !previous;
      syncSettings({ learningModeEnabled: next });
      return next;
    });
  }, [syncSettings]);

  return {
    settings,
    isSettingsLoaded,
    chromeAiReady,
    provider,
    uiRewriteProvider,
    learningProvider,
    wordLookupProvider,
    autoTranslateMode,
    hoverTranslateScope,
    hoverTranslateModifierKey,
    learningModeEnabled,
    appEnabled,
    isSaving,
    saveStatusText,
    saveStatusIsError,
    updateProvider,
    updateUiRewriteProvider,
    updateLearningProvider,
    updateWordLookupProvider,
    updateAutoTranslateMode,
    updateHoverTranslateScope,
    updateHoverTranslateModifierKey,
    toggleAppEnabled,
    toggleLearningModeEnabled,
  };
}

function getActiveTabInfo() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (chrome.runtime.lastError || !tab?.id) {
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
        resolve({ tabId: tab.id, origin, url: tab.url || "" });
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function sendPageTranslateMessage(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        resolve(error ? null : response || null);
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
  const [isTogglingSiteAutoTranslate, setIsTogglingSiteAutoTranslate] = useState(false);
  const [isPageTranslateActive, setIsPageTranslateActive] = useState(false);
  const [displayMode, setDisplayMode] = useState("translation");
  const [activeOrigin, setActiveOrigin] = useState("");
  const [siteEnabled, setSiteEnabled] = useState(false);
  const contextRef = useRef(null);
  const pendingRef = useRef({ toggle: false, mode: false, site: false });
  const pageStateRef = useRef({ active: false, mode: "translation" });
  const pageRevisionRef = useRef(0);
  const siteRevisionRef = useRef(0);
  const refreshRef = useRef(null);
  const { message: status, showMessage: showStatus, clearMessage: clearStatus } =
    useTemporaryMessage(2800);

  const applyPageState = useCallback((nextState) => {
    pageStateRef.current = nextState;
    setIsPageTranslateActive(nextState.active);
    setDisplayMode(nextState.mode);
  }, []);

  const isCurrent = useCallback((context) => (
    context !== null && context === contextRef.current && context.info !== null
  ), []);

  useEffect(() => {
    let cancelled = false;

    async function refreshActiveTabState() {
      // Every activation/navigation owns a new context, including same-origin navigation.
      const context = { info: null };
      contextRef.current = context;
      pendingRef.current = { toggle: false, mode: false, site: false };
      setIsToggling(false);
      setIsChangingDisplayMode(false);
      setIsTogglingSiteAutoTranslate(false);
      setActiveOrigin("");
      setSiteEnabled(false);
      applyPageState({ active: false, mode: "translation" });
      clearStatus();

      const info = await getActiveTabInfo();
      if (cancelled || context !== contextRef.current || !info) return;
      context.info = info;
      setActiveOrigin(info.origin);
      const pageRevision = pageRevisionRef.current;
      void sendPageTranslateMessage(info.tabId, { action: "getPageTranslateState" })
        .then((response) => {
          if (!isCurrent(context) || pageRevision !== pageRevisionRef.current || !response?.ok) return;
          const nextState = resolvePageTranslateState(response, {
            active: false,
            mode: "translation",
          });
          applyPageState(nextState);
        });

      if (!info.origin) return;
      const siteRevision = siteRevisionRef.current;
      const { isAlwaysTranslateOrigin } = await import(
        "../../shared/always-translate-origins.js"
      );
      const enabled = await isAlwaysTranslateOrigin(info.origin);
      if (isCurrent(context) && siteRevision === siteRevisionRef.current) setSiteEnabled(enabled);
    }

    function handleTabActivated() {
      void refreshActiveTabState();
    }

    function handleTabUpdated(_tabId, changeInfo, tab) {
      if (tab?.active && (changeInfo.url || changeInfo.status === "loading" || changeInfo.status === "complete")) {
        void refreshActiveTabState();
      }
    }

    refreshRef.current = refreshActiveTabState;
    void refreshActiveTabState();
    chrome.tabs.onActivated?.addListener(handleTabActivated);
    chrome.tabs.onUpdated?.addListener(handleTabUpdated);

    return () => {
      cancelled = true;
      contextRef.current = null;
      refreshRef.current = null;
      chrome.tabs.onActivated?.removeListener(handleTabActivated);
      chrome.tabs.onUpdated?.removeListener(handleTabUpdated);
    };
  }, [applyPageState, clearStatus, isCurrent]);

  const resolveTarget = useCallback(async (context) => {
    const info = await getActiveTabInfo();
    if (!isCurrent(context)) return null;
    if (!info || info.tabId !== context.info.tabId || info.url !== context.info.url) {
      // A tab query can notice the switch before Chrome dispatches the tab event.
      void refreshRef.current?.();
      showStatus(info ? "当前页面已变化，请重试。" : "未找到当前标签页。");
      return null;
    }
    return info;
  }, [isCurrent, showStatus]);

  const togglePageTranslate = useCallback(async () => {
    if (pendingRef.current.toggle || pendingRef.current.mode) return;
    if (!appEnabled) {
      showStatus("应用已关闭，请先开启应用。");
      return;
    }
    const context = contextRef.current;
    if (!isCurrent(context)) {
      showStatus("正在读取当前标签页，请稍后重试。");
      return;
    }
    const shouldStop = pageStateRef.current.active;
    pendingRef.current.toggle = true;
    pageRevisionRef.current += 1;
    setIsToggling(true);
    try {
      const info = await resolveTarget(context);
      if (!info) return;
      const response = await sendPageTranslateMessage(info.tabId, {
        action: shouldStop ? "stopVisualPageTranslate" : "startVisualPageTranslate",
      });
      if (!isCurrent(context)) return;
      if (!response) {
        showStatus("当前页面不支持页面翻译。");
        return;
      }
      if (response.ok) {
        const nextState = resolvePageTranslateState(response, {
          active: !shouldStop,
          mode: pageStateRef.current.mode,
        });
        applyPageState(nextState);
        showStatus(shouldStop
          ? "已停止继续翻译，已完成的译文会保留。"
          : "已启动：先翻译可视区域，滚动后继续。");
      } else {
        showStatus(shouldStop ? "停止失败，请重试。" : "启动失败，请重试。");
      }
    } finally {
      if (isCurrent(context)) {
        pendingRef.current.toggle = false;
        setIsToggling(false);
      }
    }
  }, [appEnabled, applyPageState, isCurrent, resolveTarget, showStatus]);

  const changeDisplayMode = useCallback(async (mode) => {
    if (pendingRef.current.mode || pendingRef.current.toggle || !appEnabled
      || !pageStateRef.current.active || !["translation", "original", "bilingual"].includes(mode)) return;
    const context = contextRef.current;
    if (!isCurrent(context)) return;
    pendingRef.current.mode = true;
    pageRevisionRef.current += 1;
    setIsChangingDisplayMode(true);
    try {
      const info = await resolveTarget(context);
      if (!info) return;
      const response = await sendPageTranslateMessage(info.tabId, { action: "setPageTranslateMode", mode });
      if (!isCurrent(context)) return;
      if (!response?.ok) {
        applyPageState({ active: false, mode: pageStateRef.current.mode });
        showStatus("当前页面的翻译状态已失效，请重新翻译。");
        return;
      }
      const nextState = resolvePageTranslateState(response, { active: pageStateRef.current.active, mode });
      applyPageState(nextState);
    } finally {
      if (isCurrent(context)) {
        pendingRef.current.mode = false;
        setIsChangingDisplayMode(false);
      }
    }
  }, [appEnabled, applyPageState, isCurrent, resolveTarget, showStatus]);

  const toggleSiteAutoTranslate = useCallback(async () => {
    if (pendingRef.current.site) return;
    if (!appEnabled) {
      showStatus("应用已关闭，请先开启应用。");
      return;
    }
    const context = contextRef.current;
    if (!isCurrent(context) || !context.info.origin) {
      showStatus("当前页面不支持自动翻译（仅 http/https）。");
      return;
    }
    const origin = context.info.origin;
    pendingRef.current.site = true;
    siteRevisionRef.current += 1;
    setIsTogglingSiteAutoTranslate(true);
    try {
      if (!await resolveTarget(context)) return;
      const { toggleAlwaysTranslateOrigin } = await import(
        "../../shared/always-translate-origins.js"
      );
      if (!isCurrent(context)) return;
      const result = await toggleAlwaysTranslateOrigin(origin);
      if (!isCurrent(context)) return;
      if (!result.ok) {
        showStatus("操作失败，请重试。");
        return;
      }
      setSiteEnabled(result.enabled);
      if (result.enabled) {
        showStatus(`已加入自动翻译：${origin}`);
        // 同时立即翻译当前页
        if (!pageStateRef.current.active) void togglePageTranslate();
      } else {
        showStatus(`已移出自动翻译：${origin}`);
      }
    } finally {
      if (isCurrent(context)) {
        pendingRef.current.site = false;
        setIsTogglingSiteAutoTranslate(false);
      }
    }
  }, [appEnabled, isCurrent, resolveTarget, showStatus, togglePageTranslate]);

  return {
    isToggling,
    isChangingDisplayMode,
    isTogglingSiteAutoTranslate,
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
