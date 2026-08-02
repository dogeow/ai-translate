import { useCallback, useEffect, useState } from "react";
import { useTemporaryMessage } from "../../shared/hooks/useTemporaryMessage.js";

const IDLE_STATE = Object.freeze({
  status: "idle",
  mode: "original",
  rate: 1,
  accent: "us",
  sectionIndex: 0,
  totalSections: 0,
  error: "",
});

function getActiveTabId() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs?.[0]?.id ?? null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

export function useArticleNarration(appEnabled) {
  const [state, setState] = useState(IDLE_STATE);
  const [isChanging, setIsChanging] = useState(false);
  const { message: statusMessage, showMessage } = useTemporaryMessage(2800);

  const refresh = useCallback(async () => {
    const tabId = await getActiveTabId();
    if (!tabId) {
      setState(IDLE_STATE);
      return;
    }
    const response = await sendTabMessage(tabId, {
      action: "getArticleNarrationState",
    });
    setState(response?.ok && response.state ? response.state : IDLE_STATE);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (isChanging) return;
    if (!appEnabled) {
      showMessage("应用已关闭，请先开启应用。");
      return;
    }
    setIsChanging(true);
    const tabId = await getActiveTabId();
    if (!tabId) {
      setIsChanging(false);
      showMessage("未找到当前标签页。");
      return;
    }
    const action =
      state.status === "playing" || state.status === "paused"
        ? "toggleArticleNarrationPause"
        : "startArticleNarration";
    const response = await sendTabMessage(tabId, { action });
    setIsChanging(false);
    if (!response) {
      showMessage("当前页面不支持文章朗读。");
      return;
    }
    if (!response.ok) {
      if (response.state) setState(response.state);
      showMessage(response.error || "没有找到可朗读的文章内容。");
      return;
    }
    if (response.state) setState(response.state);
  }, [appEnabled, isChanging, showMessage, state.status]);

  const stop = useCallback(async () => {
    if (isChanging || state.status === "idle") return;
    setIsChanging(true);
    const tabId = await getActiveTabId();
    const response = tabId
      ? await sendTabMessage(tabId, { action: "stopArticleNarration" })
      : null;
    setIsChanging(false);
    setState(response?.state || IDLE_STATE);
  }, [isChanging, state.status]);

  return {
    state,
    isChanging,
    statusMessage,
    toggle,
    stop,
  };
}
