/**
 * 滑词翻译 content script 运行时
 * 负责状态管理、消息桥接、自动翻译事件绑定。
 */
import {
  BUTTON_ID,
  SHORTCUT_HINT_ID,
  STYLE_ID,
  TIP_ID,
} from "./constants.js";
import {
  getCurrentElementAndText,
  getHoverTranslateTarget,
  getSelectionText,
  getSelectionRect,
  getElementFullText,
} from "./selection.js";
import {
  showButton,
  hideButton,
  getButtonElement,
  getButtonOrSelectionText,
} from "./button.js";
import { showTip, hideTip, setTipHideHandler } from "./tip.js";
import { showShortcutHint } from "./shortcutHint.js";
import { createVisualPageTranslator } from "./pageTranslate.js";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  SELECTION_AUTO_TRANSLATE_DELAY_MS,
} from "../shared/constants.js";
import {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
} from "../shared/settings.js";

const LOG_PREFIX = "[Ollama 翻译-Content]";
const PAGE_TRANSLATE_CHUNK_TIMEOUT_MS = 30000;
const PAGE_TRANSLATE_BATCH_TIMEOUT_MS = 45000;

export function logDebug(...args) {
  console.log(LOG_PREFIX, ...args);
}

function sendMessageSafe(msg, callback) {
  try {
    chrome.runtime.sendMessage(msg, callback);
  } catch (e) {
    logDebug("sendMessage 失败:", e.message, "msg:", msg.action);
    if (e.message && e.message.includes("Extension context invalidated")) {
      logDebug("检测到 Extension context 失效，需要刷新页面以重新连接扩展");
    }
    if (callback) {
      callback();
    }
  }
}

export function initContentRuntime() {
  const HAN_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
  const SIGNIFICANT_CHAR_RE = /[\p{L}\p{N}]/u;

  let lastTipRect = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastTranslatedElement = null;
  let autoTranslateMode = DEFAULT_AUTO_TRANSLATE_MODE;
  let translateTargetLang = DEFAULT_TRANSLATE_TARGET_LANG;
  let hoverTranslateScope = DEFAULT_HOVER_TRANSLATE_SCOPE;
  let hoverTranslateDelayMs = DEFAULT_HOVER_TRANSLATE_DELAY_MS;
  let selectionAutoTranslateTimerId = null;
  let hoverAutoTranslateTimerId = null;
  let hoverCurrentKey = "";
  let hoverPendingKey = "";
  let hoverInFlightKey = "";
  let hoverLastResolvedKey = "";
  let activeHoverRequestId = "";
  let lastCompletedHoverRequestId = "";
  let hoverRequestSeq = 0;
  let activeTipRequestId = "";
  let dismissedTipRequestId = "";
  let pageTranslateConcurrency = DEFAULT_PAGE_TRANSLATE_CONCURRENCY;
  let pageTranslateBatchChars = DEFAULT_PAGE_TRANSLATE_BATCH_CHARS;
  let pageTranslator = null;

  function isMostlyChineseText(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    const significantChars = Array.from(value).filter((char) =>
      SIGNIFICANT_CHAR_RE.test(char),
    );
    if (significantChars.length === 0) return false;

    let hanCount = 0;
    for (const char of significantChars) {
      if (HAN_CHAR_RE.test(char)) {
        hanCount += 1;
      }
    }

    if (hanCount === 0) return false;
    if (significantChars.length <= 4 && hanCount === significantChars.length) {
      return true;
    }

    return hanCount / significantChars.length >= 0.6;
  }

  function isChineseIdentifierText(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    if (!HAN_CHAR_RE.test(value)) return false;
    if (!/\d/.test(value)) return false;
    if (!/^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\dA-Za-z\-·.]+$/.test(value))
      return false;
    const digits = value.match(/\d/g) || [];
    return digits.length / value.length >= 0.3;
  }

  function shouldSkipHoverTranslate(text) {
    if (isChineseIdentifierText(text)) return true;
    return translateTargetLang === "Chinese" && isMostlyChineseText(text);
  }

  function shouldSkipPageTranslate(text) {
    if (isChineseIdentifierText(text)) return true;
    return translateTargetLang === "Chinese" && isMostlyChineseText(text);
  }

  function clearSelectionAutoTranslateTimer() {
    if (selectionAutoTranslateTimerId !== null) {
      clearTimeout(selectionAutoTranslateTimerId);
      selectionAutoTranslateTimerId = null;
    }
  }

  function clearHoverAutoTranslateTimer({ preserveLastResolved = false } = {}) {
    if (hoverAutoTranslateTimerId !== null) {
      clearTimeout(hoverAutoTranslateTimerId);
      hoverAutoTranslateTimerId = null;
    }
    hoverCurrentKey = "";
    hoverPendingKey = "";
    hoverInFlightKey = "";
    activeHoverRequestId = "";
    if (!preserveLastResolved) {
      hoverLastResolvedKey = "";
    }
  }

  function resetHoverResolvedKeyIfLeaving(nextKey = "") {
    if (!hoverLastResolvedKey) return;
    if (!hoverCurrentKey) {
      hoverLastResolvedKey = "";
      return;
    }
    if (nextKey && nextKey === hoverLastResolvedKey) return;
    if (hoverCurrentKey === hoverLastResolvedKey) {
      hoverLastResolvedKey = "";
    }
  }

  function isExtensionUiTarget(target) {
    return !!(
      target &&
      target.closest &&
      target.closest(`#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}`)
    );
  }

  function applyAutoTranslateSettings(cfg) {
    autoTranslateMode = normalizeAutoTranslateMode(
      cfg.ollamaAutoTranslateMode,
      cfg.ollamaAutoTranslateSelection,
    );
    translateTargetLang =
      cfg.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG;
    hoverTranslateScope = normalizeHoverTranslateScope(
      cfg.ollamaHoverTranslateScope,
    );
    hoverTranslateDelayMs = normalizeHoverTranslateDelayMs(
      cfg.ollamaHoverTranslateDelayMs,
    );
    pageTranslateConcurrency = normalizePageTranslateConcurrency(
      cfg.ollamaPageTranslateConcurrency,
    );
    pageTranslateBatchChars = normalizePageTranslateBatchChars(
      cfg.ollamaPageTranslateBatchChars,
    );
    if (pageTranslator) {
      pageTranslator.updateOptions({
        maxConcurrent: pageTranslateConcurrency,
        batchChars: pageTranslateBatchChars,
      });
    }
    if (autoTranslateMode !== "hotkey") hideButton();
    clearSelectionAutoTranslateTimer();
    clearHoverAutoTranslateTimer({ preserveLastResolved: true });
  }

  chrome.storage.sync.get(
    {
      ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
      ollamaAutoTranslateSelection: false,
      translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
      ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
      ollamaHoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
      ollamaPageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
      ollamaPageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
    },
    applyAutoTranslateSettings,
  );

  function onStorageChanged(changes, area) {
    if (area !== "sync") return;
    if (
      !("ollamaAutoTranslateMode" in changes) &&
      !("ollamaAutoTranslateSelection" in changes) &&
      !("translateTargetLang" in changes) &&
      !("ollamaHoverTranslateScope" in changes) &&
      !("ollamaHoverTranslateDelayMs" in changes) &&
      !("ollamaPageTranslateConcurrency" in changes) &&
      !("ollamaPageTranslateBatchChars" in changes)
    ) {
      return;
    }
    chrome.storage.sync.get(
      {
        ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
        ollamaAutoTranslateSelection: false,
        translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
        ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
        ollamaHoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
        ollamaPageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
        ollamaPageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
      },
      applyAutoTranslateSettings,
    );
  }
  chrome.storage.onChanged.addListener(onStorageChanged);

  function requestPageChunkTranslate(text) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(payload);
      };
      const timer = window.setTimeout(() => {
        finish({ ok: false, error: "timeout" });
      }, PAGE_TRANSLATE_CHUNK_TIMEOUT_MS);

      sendMessageSafe(
        {
          action: "translatePageTextChunk",
          text,
          triggerSource: "page-visual",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            finish({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          finish(response || { ok: false, error: "empty_response" });
        },
      );
    });
  }

  function requestPageBatchTranslate(texts) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(payload);
      };
      const timer = window.setTimeout(() => {
        finish({ ok: false, error: "timeout" });
      }, PAGE_TRANSLATE_BATCH_TIMEOUT_MS);

      sendMessageSafe(
        {
          action: "translatePageTextBatch",
          texts,
          triggerSource: "page-visual-batch",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            finish({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          finish(response || { ok: false, error: "empty_response" });
        },
      );
    });
  }

  pageTranslator = createVisualPageTranslator({
    requestChunkTranslation: requestPageChunkTranslate,
    requestBatchTranslation: requestPageBatchTranslate,
    onStatusMessage: (message) => showShortcutHint(message),
    shouldSkipText: shouldSkipPageTranslate,
    isUiElement: (element) => isExtensionUiTarget(element),
    initialOptions: {
      maxConcurrent: pageTranslateConcurrency,
      batchChars: pageTranslateBatchChars,
    },
  });

  setTipHideHandler(() => {
    dismissedTipRequestId = activeTipRequestId || dismissedTipRequestId;
    activeTipRequestId = "";
  });

  function onButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const text = getButtonOrSelectionText();
    lastTipRect = getSelectionRect();
    hideButton();
    if (window.getSelection()) window.getSelection().removeAllRanges();
    if (text) {
      sendMessageSafe({ action: "translate", text }, () => {
        if (chrome.runtime.lastError) {
          logDebug("按钮点击翻译失败:", chrome.runtime.lastError.message);
        }
      });
    }
  }

  const btn = getButtonElement();
  if (btn._ollamaClickHandler) {
    btn.removeEventListener("click", btn._ollamaClickHandler);
  }
  btn._ollamaClickHandler = onButtonClick;
  btn.addEventListener("click", onButtonClick);

  function onRuntimeMessage(msg, _sender, sendResponse) {
    if (
      msg.requestId &&
      dismissedTipRequestId &&
      msg.requestId === dismissedTipRequestId
    ) {
      return;
    }

    if (msg.action === "showTranslatePending") {
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== activeHoverRequestId) return;
      }
      if (msg.requestId && msg.requestId !== dismissedTipRequestId) {
        dismissedTipRequestId = "";
      }
      activeTipRequestId = msg.requestId || "";
      showTip({ ...msg, pending: true }, lastTipRect);
    } else if (msg.action === "showTranslateResult") {
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== activeHoverRequestId) return;
        hoverLastResolvedKey = hoverCurrentKey || hoverLastResolvedKey;
        hoverInFlightKey = "";
        activeHoverRequestId = "";
        lastCompletedHoverRequestId = msg.requestId;
      }
      if (msg.requestId && msg.requestId !== dismissedTipRequestId) {
        dismissedTipRequestId = "";
      }
      activeTipRequestId = msg.requestId || activeTipRequestId;
      showTip(msg, lastTipRect);
    } else if (msg.action === "updateSentenceStudy") {
      const tip = document.getElementById(TIP_ID);
      if (!tip) return;
      if (
        msg.requestId &&
        activeTipRequestId &&
        msg.requestId !== activeTipRequestId
      ) {
        return;
      }
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== lastCompletedHoverRequestId) return;
      }
      if (msg.requestId && msg.requestId !== dismissedTipRequestId) {
        dismissedTipRequestId = "";
      }
      activeTipRequestId = msg.requestId || activeTipRequestId;
      showTip(msg, lastTipRect);
    } else if (msg.action === "showShortcutHint" && msg.message) {
      showShortcutHint(msg.message);
    } else if (msg.action === "startVisualPageTranslate") {
      pageTranslator.start();
      sendResponse({ ok: true, active: pageTranslator.isActive() });
      return true;
    } else if (msg.action === "getTextToTranslate") {
      const { element: currentElement, text: currentText } =
        getCurrentElementAndText(lastMouseX, lastMouseY);

      if (!currentText && !currentElement) {
        sendResponse({ text: "", source: "" });
        return true;
      }

      let text = "";
      let source = "";

      if (lastTranslatedElement && currentElement === lastTranslatedElement) {
        let parent = lastTranslatedElement.parentElement;
        if (parent === document.documentElement) parent = document.body;
        if (!parent) {
          text = currentText;
          source = "selection";
        } else {
          text = getElementFullText(parent);
          lastTranslatedElement = parent;
          source = "expand";
          const r = parent.getBoundingClientRect();
          lastTipRect = {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
          };
        }
      } else {
        text = currentText;
        lastTranslatedElement = currentElement;
        source = currentElement ? "selection" : "";
        if (text && !getSelectionText()) {
          lastTipRect = {
            bottom: lastMouseY + 4,
            left: lastMouseX,
            top: lastMouseY - 4,
            right: lastMouseX + 4,
            width: 0,
            height: 0,
          };
        }
      }

      if (!text.trim()) {
        sendResponse({ text: "", source: "" });
        return true;
      }

      sendResponse({
        text: text.trim(),
        source: source || "hover",
      });
      return true;
    }
  }
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function onSelectionChange() {
    const text = getSelectionText();
    if (!text) {
      hideButton();
      return;
    }
    if (autoTranslateMode !== "hotkey") {
      hideButton();
      return;
    }
    showButton(text);
  }

  function onMouseUp(e) {
    if (e.button !== 0) return;
    const clickCount = e.detail || 1;
    const clientX = e.clientX;
    const clientY = e.clientY;

    setTimeout(onSelectionChange, 10);
    if (autoTranslateMode !== "selection" || clickCount < 2) return;

    clearSelectionAutoTranslateTimer();
    selectionAutoTranslateTimerId = window.setTimeout(() => {
      selectionAutoTranslateTimerId = null;
      let text = getSelectionText().trim();
      let anchorRect = getSelectionRect() || lastTipRect;
      let translatedElement = null;

      if (!text) {
        const fallbackScope = clickCount >= 3 ? "paragraph" : "word";
        const hoverTarget = getHoverTranslateTarget(
          clientX,
          clientY,
          fallbackScope,
        );
        if (!hoverTarget?.text?.trim()) return;
        text = hoverTarget.text.trim();
        anchorRect = hoverTarget.rect || anchorRect;
        translatedElement = hoverTarget.element || null;
      }

      if (!text) return;
      lastTipRect = anchorRect || lastTipRect;
      if (translatedElement) {
        lastTranslatedElement = translatedElement;
      }
      logDebug(`双击/三击触发翻译：text="${text.substring(0, 20)}..."`);
      sendMessageSafe({ action: "translate", text }, () => {
        if (chrome.runtime.lastError) {
          logDebug("双击/三击翻译请求失败:", chrome.runtime.lastError.message);
        }
      });
    }, SELECTION_AUTO_TRANSLATE_DELAY_MS);
  }

  function onScroll() {
    hideButton();
    if (autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    pageTranslator.handleViewportChanged();
  }

  function onResize() {
    pageTranslator.handleViewportChanged();
  }

  function onMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (autoTranslateMode !== "hover") return;
    if (e.buttons !== 0 || getSelectionText() || isExtensionUiTarget(e.target)) {
      resetHoverResolvedKeyIfLeaving("");
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    const hoverTarget = getHoverTranslateTarget(
      e.clientX,
      e.clientY,
      hoverTranslateScope,
    );
    const key = hoverTarget?.key || "";
    const hoverText = (hoverTarget?.text || "").trim();
    if (!key || !hoverText) {
      resetHoverResolvedKeyIfLeaving("");
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    if (shouldSkipHoverTranslate(hoverText)) {
      if (hoverAutoTranslateTimerId !== null) {
        clearTimeout(hoverAutoTranslateTimerId);
        hoverAutoTranslateTimerId = null;
      }
      if (key !== hoverCurrentKey) {
        resetHoverResolvedKeyIfLeaving(key);
        hoverCurrentKey = key;
      }
      hoverPendingKey = "";
      hoverInFlightKey = "";
      activeHoverRequestId = "";
      return;
    }

    if (key !== hoverCurrentKey) {
      resetHoverResolvedKeyIfLeaving(key);
      if (hoverAutoTranslateTimerId !== null) {
        clearTimeout(hoverAutoTranslateTimerId);
        hoverAutoTranslateTimerId = null;
      }
      hoverCurrentKey = key;
      hoverPendingKey = "";
      hoverInFlightKey = "";
      activeHoverRequestId = "";
    }

    if (
      key === hoverPendingKey ||
      key === hoverInFlightKey ||
      key === hoverLastResolvedKey
    ) {
      return;
    }

    hoverPendingKey = key;
    const requestId = `hover:${Date.now()}:${++hoverRequestSeq}`;
    logDebug(
      `悬停触发：text="${hoverText.substring(0, 20)}...", requestId=${requestId}`,
    );
    hoverAutoTranslateTimerId = window.setTimeout(() => {
      hoverAutoTranslateTimerId = null;
      hoverPendingKey = "";
      if (autoTranslateMode !== "hover" || hoverCurrentKey !== key) {
        logDebug(
          `悬停已取消：mode=${autoTranslateMode}, currentKey=${hoverCurrentKey}, key=${key}`,
        );
        return;
      }

      hoverInFlightKey = key;
      activeHoverRequestId = requestId;
      lastCompletedHoverRequestId = "";
      lastTranslatedElement = hoverTarget.element || null;
      lastTipRect = hoverTarget.rect || {
        bottom: lastMouseY + 4,
        left: lastMouseX,
        top: lastMouseY - 4,
        right: lastMouseX + 4,
        width: 0,
        height: 0,
      };

      logDebug(`发送悬停翻译请求：${requestId}`);
      const hoverCallback = () => {
        if (chrome.runtime.lastError) {
          if (activeHoverRequestId === requestId) {
            activeHoverRequestId = "";
            hoverInFlightKey = "";
          }
          logDebug("悬停翻译请求失败:", chrome.runtime.lastError.message);
        }
      };
      sendMessageSafe(
        {
          action: "translate",
          text: hoverText,
          triggerSource: "hover",
          requestId,
        },
        hoverCallback,
      );
    }, hoverTranslateDelayMs);
  }

  function onSelectionChangedEvent() {
    if (autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    onSelectionChange();
  }

  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("selectionchange", onSelectionChangedEvent, true);
  document.addEventListener("scroll", onScroll, true);
  document.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("resize", onResize);

  return function cleanup() {
    clearSelectionAutoTranslateTimer();
    clearHoverAutoTranslateTimer();
    pageTranslator.stop();
    setTipHideHandler(null);
    hideButton();
    hideTip();
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    document.removeEventListener("mouseup", onMouseUp, true);
    document.removeEventListener(
      "selectionchange",
      onSelectionChangedEvent,
      true,
    );
    document.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("resize", onResize);
    if (btn._ollamaClickHandler) {
      btn.removeEventListener("click", btn._ollamaClickHandler);
      delete btn._ollamaClickHandler;
    }
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  };
}
