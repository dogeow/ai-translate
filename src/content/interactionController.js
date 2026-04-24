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
import { SELECTION_AUTO_TRANSLATE_DELAY_MS } from "../shared/constants.js";
import { logDebug, sendMessageSafe } from "./runtimeShared.js";

export function createInteractionController({
  state,
  pageTranslator,
  shouldSkipHoverTranslate,
}) {
  function clearSelectionAutoTranslateTimer() {
    if (state.selectionAutoTranslateTimerId !== null) {
      clearTimeout(state.selectionAutoTranslateTimerId);
      state.selectionAutoTranslateTimerId = null;
    }
  }

  function clearHoverAutoTranslateTimer({ preserveLastResolved = false } = {}) {
    if (state.hoverAutoTranslateTimerId !== null) {
      clearTimeout(state.hoverAutoTranslateTimerId);
      state.hoverAutoTranslateTimerId = null;
    }
    state.hoverCurrentKey = "";
    state.hoverPendingKey = "";
    state.hoverInFlightKey = "";
    state.activeHoverRequestId = "";
    if (!preserveLastResolved) {
      state.hoverLastResolvedKey = "";
    }
  }

  function resetHoverResolvedKeyIfLeaving(nextKey = "") {
    if (!state.hoverLastResolvedKey) return;
    if (!state.hoverCurrentKey) {
      state.hoverLastResolvedKey = "";
      return;
    }
    if (nextKey && nextKey === state.hoverLastResolvedKey) return;
    if (state.hoverCurrentKey === state.hoverLastResolvedKey) {
      state.hoverLastResolvedKey = "";
    }
  }

  function isExtensionUiTarget(target) {
    return !!(
      target &&
      target.closest &&
      target.closest(`#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}`)
    );
  }

  function onButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const text = getButtonOrSelectionText();
    state.lastTipRect = getSelectionRect();
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

  setTipHideHandler(() => {
    state.dismissedTipRequestId =
      state.activeTipRequestId || state.dismissedTipRequestId;
    state.activeTipRequestId = "";
  });

  function onRuntimeMessage(msg, _sender, sendResponse) {
    if (
      msg.requestId &&
      state.dismissedTipRequestId &&
      msg.requestId === state.dismissedTipRequestId
    ) {
      return;
    }

    if (msg.action === "showTranslatePending") {
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== state.activeHoverRequestId) return;
      }
      if (msg.requestId && msg.requestId !== state.dismissedTipRequestId) {
        state.dismissedTipRequestId = "";
      }
      state.activeTipRequestId = msg.requestId || "";
      showTip({ ...msg, pending: true }, state.lastTipRect);
      return;
    }

    if (msg.action === "showTranslateResult") {
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== state.activeHoverRequestId) return;
        state.hoverLastResolvedKey =
          state.hoverCurrentKey || state.hoverLastResolvedKey;
        state.hoverInFlightKey = "";
        state.activeHoverRequestId = "";
        state.lastCompletedHoverRequestId = msg.requestId;
      }
      if (msg.requestId && msg.requestId !== state.dismissedTipRequestId) {
        state.dismissedTipRequestId = "";
      }
      state.activeTipRequestId = msg.requestId || state.activeTipRequestId;
      showTip(msg, state.lastTipRect);
      return;
    }

    if (msg.action === "updateSentenceStudy") {
      const tip = document.getElementById(TIP_ID);
      if (!tip) return;
      if (
        msg.requestId &&
        state.activeTipRequestId &&
        msg.requestId !== state.activeTipRequestId
      ) {
        return;
      }
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== state.lastCompletedHoverRequestId) return;
      }
      if (msg.requestId && msg.requestId !== state.dismissedTipRequestId) {
        state.dismissedTipRequestId = "";
      }
      state.activeTipRequestId = msg.requestId || state.activeTipRequestId;
      showTip(msg, state.lastTipRect);
      return;
    }

    if (msg.action === "showShortcutHint" && msg.message) {
      showShortcutHint(msg.message);
      return;
    }

    if (msg.action === "startVisualPageTranslate") {
      pageTranslator.start();
      sendResponse({ ok: true, active: pageTranslator.isActive() });
      return true;
    }

    if (msg.action === "getTextToTranslate") {
      const { element: currentElement, text: currentText } =
        getCurrentElementAndText(state.lastMouseX, state.lastMouseY);

      if (!currentText && !currentElement) {
        sendResponse({ text: "", source: "" });
        return true;
      }

      let text = "";
      let source = "";

      if (
        state.lastTranslatedElement &&
        currentElement === state.lastTranslatedElement
      ) {
        let parent = state.lastTranslatedElement.parentElement;
        if (parent === document.documentElement) parent = document.body;
        if (!parent) {
          text = currentText;
          source = "selection";
        } else {
          text = getElementFullText(parent);
          state.lastTranslatedElement = parent;
          source = "expand";
          const r = parent.getBoundingClientRect();
          state.lastTipRect = {
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
        state.lastTranslatedElement = currentElement;
        source = currentElement ? "selection" : "";
        if (text && !getSelectionText()) {
          state.lastTipRect = {
            bottom: state.lastMouseY + 4,
            left: state.lastMouseX,
            top: state.lastMouseY - 4,
            right: state.lastMouseX + 4,
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
    if (state.autoTranslateMode !== "hotkey") {
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
    if (state.autoTranslateMode !== "selection" || clickCount < 2) return;

    clearSelectionAutoTranslateTimer();
    state.selectionAutoTranslateTimerId = window.setTimeout(() => {
      state.selectionAutoTranslateTimerId = null;
      let text = getSelectionText().trim();
      let anchorRect = getSelectionRect() || state.lastTipRect;
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
      state.lastTipRect = anchorRect || state.lastTipRect;
      if (translatedElement) {
        state.lastTranslatedElement = translatedElement;
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
    if (state.autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    pageTranslator.handleViewportChanged();
  }

  function onResize() {
    pageTranslator.handleViewportChanged();
  }

  function onMouseMove(e) {
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;

    if (state.autoTranslateMode !== "hover") return;
    if (e.buttons !== 0 || getSelectionText() || isExtensionUiTarget(e.target)) {
      resetHoverResolvedKeyIfLeaving("");
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    const hoverTarget = getHoverTranslateTarget(
      e.clientX,
      e.clientY,
      state.hoverTranslateScope,
    );
    const key = hoverTarget?.key || "";
    const hoverText = (hoverTarget?.text || "").trim();
    if (!key || !hoverText) {
      resetHoverResolvedKeyIfLeaving("");
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    if (shouldSkipHoverTranslate(hoverText)) {
      if (state.hoverAutoTranslateTimerId !== null) {
        clearTimeout(state.hoverAutoTranslateTimerId);
        state.hoverAutoTranslateTimerId = null;
      }
      if (key !== state.hoverCurrentKey) {
        resetHoverResolvedKeyIfLeaving(key);
        state.hoverCurrentKey = key;
      }
      state.hoverPendingKey = "";
      state.hoverInFlightKey = "";
      state.activeHoverRequestId = "";
      return;
    }

    if (key !== state.hoverCurrentKey) {
      resetHoverResolvedKeyIfLeaving(key);
      if (state.hoverAutoTranslateTimerId !== null) {
        clearTimeout(state.hoverAutoTranslateTimerId);
        state.hoverAutoTranslateTimerId = null;
      }
      state.hoverCurrentKey = key;
      state.hoverPendingKey = "";
      state.hoverInFlightKey = "";
      state.activeHoverRequestId = "";
    }

    if (
      key === state.hoverPendingKey ||
      key === state.hoverInFlightKey ||
      key === state.hoverLastResolvedKey
    ) {
      return;
    }

    state.hoverPendingKey = key;
    const requestId = `hover:${Date.now()}:${++state.hoverRequestSeq}`;
    logDebug(
      `悬停触发：text="${hoverText.substring(0, 20)}...", requestId=${requestId}`,
    );
    state.hoverAutoTranslateTimerId = window.setTimeout(() => {
      state.hoverAutoTranslateTimerId = null;
      state.hoverPendingKey = "";
      if (
        state.autoTranslateMode !== "hover" ||
        state.hoverCurrentKey !== key
      ) {
        logDebug(
          `悬停已取消：mode=${state.autoTranslateMode}, currentKey=${state.hoverCurrentKey}, key=${key}`,
        );
        return;
      }

      state.hoverInFlightKey = key;
      state.activeHoverRequestId = requestId;
      state.lastCompletedHoverRequestId = "";
      state.lastTranslatedElement = hoverTarget.element || null;
      state.lastTipRect = hoverTarget.rect || {
        bottom: state.lastMouseY + 4,
        left: state.lastMouseX,
        top: state.lastMouseY - 4,
        right: state.lastMouseX + 4,
        width: 0,
        height: 0,
      };

      logDebug(`发送悬停翻译请求：${requestId}`);
      sendMessageSafe(
        {
          action: "translate",
          text: hoverText,
          triggerSource: "hover",
          requestId,
        },
        () => {
          if (chrome.runtime.lastError) {
            if (state.activeHoverRequestId === requestId) {
              state.activeHoverRequestId = "";
              state.hoverInFlightKey = "";
            }
            logDebug("悬停翻译请求失败:", chrome.runtime.lastError.message);
          }
        },
      );
    }, state.hoverTranslateDelayMs);
  }

  function onSelectionChangedEvent() {
    if (state.autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    onSelectionChange();
  }

  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("selectionchange", onSelectionChangedEvent, true);
  document.addEventListener("scroll", onScroll, true);
  document.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("resize", onResize);

  return {
    clearSelectionAutoTranslateTimer,
    clearHoverAutoTranslateTimer,
    cleanup() {
      clearSelectionAutoTranslateTimer();
      clearHoverAutoTranslateTimer();
      pageTranslator.stop();
      setTipHideHandler(null);
      hideButton();
      hideTip();
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
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
    },
  };
}
