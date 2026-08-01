import { useCallback, useEffect, useMemo, useState } from "react";
import { UI_REWRITE_ORIGINAL_VERSION } from "../../shared/ui-rewrites.js";
import { resolveUiRewriteViewState } from "../lib/uiRewriteState.js";

function queryActiveTab() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs?.[0] || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function sendBackgroundMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function isSupportedTab(tab) {
  return Boolean(tab?.id && /^https?:/.test(tab.url || ""));
}

export function useCurrentPageRewrite() {
  const [activeTab, setActiveTab] = useState(null);
  const [rule, setRule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const tab = await queryActiveTab();
    setActiveTab(tab);
    if (!isSupportedTab(tab)) {
      setRule(null);
      setIsLoading(false);
      return null;
    }
    const response = await sendBackgroundMessage({
      action: "getUiRewriteForUrl",
      url: tab.url,
    });
    const nextRule = response?.ok ? response.rule || null : null;
    setRule(nextRule);
    setIsLoading(false);
    return nextRule;
  }, []);

  useEffect(() => {
    void reload();

    function handleTabActivated() {
      void reload();
    }

    function handleTabUpdated(_tabId, changeInfo, tab) {
      if (tab?.active && (changeInfo.url || changeInfo.status === "complete")) {
        void reload();
      }
    }

    function handleStorageChanged(changes, areaName) {
      if (areaName === "local" && "uiRewrites" in changes) {
        void reload();
      }
    }

    chrome.tabs.onActivated?.addListener(handleTabActivated);
    chrome.tabs.onUpdated?.addListener(handleTabUpdated);
    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => {
      chrome.tabs.onActivated?.removeListener(handleTabActivated);
      chrome.tabs.onUpdated?.removeListener(handleTabUpdated);
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [reload]);

  const viewState = useMemo(
    () => resolveUiRewriteViewState(rule),
    [rule],
  );

  const restoreOriginal = useCallback(async () => {
    if (!rule?.id || isRestoring) return false;
    setIsRestoring(true);
    const response = await sendBackgroundMessage({
      action: "setUiRewriteActiveVersion",
      ruleId: rule.id,
      versionId: UI_REWRITE_ORIGINAL_VERSION,
    });
    setIsRestoring(false);
    if (!response?.ok) return false;
    setRule(response.rule || { ...rule, activeVersionId: "original" });
    return true;
  }, [isRestoring, rule]);

  const markApplied = useCallback((nextRule, version) => {
    if (!nextRule) return;
    setRule({
      ...nextRule,
      activeVersionId: version?.id || nextRule.activeVersionId,
    });
  }, []);

  return {
    activeTab,
    isSupportedPage: isSupportedTab(activeTab),
    isLoading,
    isRestoring,
    ...viewState,
    restoreOriginal,
    markApplied,
  };
}
