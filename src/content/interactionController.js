import {
  BUTTON_ID,
  HOVER_TARGET_INDICATOR_ID,
  SHORTCUT_HINT_ID,
  STYLE_ID,
  TIP_ID,
  WORD_MARKER_CARD_ID,
  WORD_MARKER_SPAN_CLASS,
} from "./constants.js";
import {
  getCurrentElementAndText,
  getHoverTranslateTarget,
  getSelectionText,
  getSelectionRect,
  resolveHoverTranslateScope,
  resolveSelectionButtonAnchorRect,
  resolveShortcutTranslationTarget,
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
import {
  hideHoverTargetIndicator,
  removeHoverTargetIndicator,
  showHoverTargetIndicator,
} from "./hoverTargetIndicator.js";
import {
  isHoverModifierActive,
  isHoverModifierKeyEvent,
  resolveHoverModifierActiveForTarget,
} from "./hoverModifier.js";
import { dismissWordMarkerCard } from "./wordMarker.js";
import { shouldPreferWordMarkerCard } from "./wordMarkerPolicy.js";

export function createInteractionController({
  state,
  pageTranslator,
  articleNarrator,
  shouldSkipHoverTranslate,
}) {
  function isInteractionEnabled() {
    return state.appEnabled !== false;
  }

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
    hideHoverTargetIndicator();
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
      target.closest(
        `#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}, #${HOVER_TARGET_INDICATOR_ID}, #${WORD_MARKER_CARD_ID}`,
      )
    );
  }

  function onButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isInteractionEnabled()) {
      hideButton();
      hideTip();
      return;
    }
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
    if (!isInteractionEnabled()) {
      if (msg.action === "startVisualPageTranslate") {
        pageTranslator.stop();
        sendResponse({ ok: false, active: false, disabled: true });
        return true;
      }

      if (msg.action === "startArticleNarration") {
        articleNarrator?.stop?.();
        sendResponse({ ok: false, disabled: true, state: articleNarrator?.getState?.() });
        return true;
      }

      if (msg.action === "getArticleNarrationState") {
        sendResponse({ ok: true, state: articleNarrator?.getState?.() });
        return true;
      }

      if (msg.action === "getTextToTranslate") {
        sendResponse({ text: "", source: "" });
        return true;
      }

      return;
    }

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
      dismissWordMarkerCard();
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
      dismissWordMarkerCard();
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
      sendResponse({
        ok: true,
        active: pageTranslator.isActive(),
        mode: pageTranslator.getDisplayMode?.() || "translation",
      });
      return true;
    }

    if (msg.action === "stopVisualPageTranslate") {
      pageTranslator.stop();
      sendResponse({
        ok: true,
        active: false,
        mode: pageTranslator.getDisplayMode?.() || "translation",
      });
      return true;
    }

    if (msg.action === "getPageTranslateState") {
      sendResponse({
        ok: true,
        active: pageTranslator.isActive(),
        mode: pageTranslator.getDisplayMode?.() || "translation",
      });
      return true;
    }

    if (msg.action === "togglePageTranslate") {
      if (pageTranslator.isActive()) {
        pageTranslator.stop();
        sendResponse({ ok: true, toggled: true, active: false });
      } else {
        pageTranslator.start();
        sendResponse({
          ok: true,
          toggled: true,
          active: pageTranslator.isActive(),
        });
      }
      return true;
    }

    if (msg.action === "cyclePageTranslateMode") {
      const order = ["translation", "original", "bilingual"];
      const current =
        pageTranslator.getDisplayMode?.() || "translation";
      const next = order[(order.indexOf(current) + 1) % order.length];
      pageTranslator.setDisplayMode?.(next);
      const labelMap = {
        translation: "译文",
        original: "原文",
        bilingual: "双语",
      };
      showShortcutHint(`显示模式：${labelMap[next] || next}`);
      sendResponse({ ok: true, mode: next });
      return true;
    }

    if (msg.action === "setPageTranslateMode" && msg.mode) {
      pageTranslator.setDisplayMode?.(msg.mode);
      const mode = pageTranslator.getDisplayMode?.() || "translation";
      sendResponse({
        ok: mode === msg.mode,
        active: pageTranslator.isActive(),
        mode,
      });
      return true;
    }

    if (msg.action === "getArticleNarrationState") {
      sendResponse({ ok: true, state: articleNarrator?.getState?.() });
      return true;
    }

    if (msg.action === "startArticleNarration") {
      const result = articleNarrator?.start?.({
        // Do not pass lastMouseTarget as "explicit" — opening the popup moves
        // the pointer off the article. Resolver uses content click + viewport.
        contentClickTarget:
          state.narrationContentAnchor?.element || state.lastMouseTarget,
      }) || { ok: false, error: "当前页面不支持文章朗读。" };
      if (result?.notice) {
        showShortcutHint?.(result.notice);
      }
      sendResponse(result);
      return true;
    }

    if (msg.action === "toggleArticleNarrationPause") {
      const current = articleNarrator?.getState?.();
      let nextState = current;
      if (current?.status === "paused") {
        nextState = articleNarrator.resume();
      } else if (current?.status === "playing") {
        nextState = articleNarrator.pause();
      } else {
        const result = articleNarrator?.start?.({
          contentClickTarget:
            state.narrationContentAnchor?.element || state.lastMouseTarget,
        }) || { ok: false, error: "当前页面不支持文章朗读。" };
        if (result?.notice) {
          showShortcutHint?.(result.notice);
        }
        sendResponse(result);
        return true;
      }
      sendResponse({ ok: true, state: nextState });
      return true;
    }

    if (msg.action === "stopArticleNarration") {
      const nextState = articleNarrator?.stop?.();
      sendResponse({ ok: true, state: nextState });
      return true;
    }

    if (msg.action === "getTextToTranslate") {
      const { element: currentElement, text: currentText } =
        getCurrentElementAndText(state.lastMouseX, state.lastMouseY);

      if (!currentText && !currentElement) {
        sendResponse({ text: "", source: "" });
        return true;
      }

      const target = resolveShortcutTranslationTarget({
        currentElement,
        currentText,
        lastTranslatedElement: state.lastTranslatedElement,
        lastTranslatedText: state.lastTranslatedText,
      });
      const { text, source } = target;
      state.lastTranslatedElement = target.anchorElement;
      state.lastTranslatedText = target.anchorText;

      if (source === "expand" && target.targetElement) {
        const r = target.targetElement.getBoundingClientRect();
        state.lastTipRect = {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
        };
      } else if (text && !getSelectionText()) {
        state.lastTipRect = {
          bottom: state.lastMouseY + 4,
          left: state.lastMouseX,
          top: state.lastMouseY - 4,
          right: state.lastMouseX + 4,
          width: 0,
          height: 0,
        };
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

  function onSelectionChange(clickCount = 0) {
    if (!isInteractionEnabled()) {
      hideButton();
      return;
    }
    const text = getSelectionText();
    if (!text) {
      state.selectionButtonWordRect = null;
      hideButton();
      return;
    }
    if (state.autoTranslateMode !== "hotkey") {
      state.selectionButtonWordRect = null;
      hideButton();
      return;
    }
    const selectionRect = getSelectionRect();
    if (clickCount === 2 && selectionRect) {
      state.selectionButtonWordRect = selectionRect;
    } else if (clickCount < 2) {
      state.selectionButtonWordRect = null;
    }
    const anchorRect = resolveSelectionButtonAnchorRect({
      clickCount,
      selectionRect,
      wordSelectionRect: state.selectionButtonWordRect,
    });
    showButton(text, anchorRect);
  }

  function onMouseDown(e) {
    if (e.button !== 0 || isExtensionUiTarget(e.target)) return;
    state.selectionPointerClickCount = e.detail || 1;
  }

  function onMouseUp(e) {
    if (!isInteractionEnabled()) return;
    if (e.button !== 0) return;
    const clickCount = e.detail || 1;
    const clientX = e.clientX;
    const clientY = e.clientY;

    setTimeout(() => {
      onSelectionChange(clickCount);
      state.selectionPointerClickCount = 0;
    }, 10);
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
        state.lastTranslatedText = text;
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
    if (state.autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    pageTranslator.handleViewportChanged();
  }

  function updateHoverAtPoint(clientX, clientY, buttons, eventTarget) {
    if (!isInteractionEnabled()) return;
    if (state.autoTranslateMode !== "hover") return;
    if (
      buttons !== 0 ||
      getSelectionText() ||
      isExtensionUiTarget(eventTarget)
    ) {
      resetHoverResolvedKeyIfLeaving("");
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    const markedWordElement = eventTarget?.closest?.(
      `.${WORD_MARKER_SPAN_CLASS}`,
    );
    const isMarkedWord = !!markedWordElement;
    const effectiveModifierActive = resolveHoverModifierActiveForTarget({
      modifierActive: state.hoverModifierActive,
      modifierKey: state.hoverTranslateModifierKey,
      recognitionModeWord:
        markedWordElement?.dataset?.recognitionMode === "true",
    });
    const effectiveScope = resolveHoverTranslateScope(
      state.hoverTranslateScope,
      effectiveModifierActive,
    );
    if (
      shouldPreferWordMarkerCard({
        isMarkedWord,
        effectiveScope,
      })
    ) {
      if (state.activeTipRequestId?.startsWith("hover:")) {
        hideTip();
      }
      resetHoverResolvedKeyIfLeaving("");
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }
    const hoverTarget = getHoverTranslateTarget(
      clientX,
      clientY,
      effectiveScope,
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
      hideHoverTargetIndicator();
      return;
    }

    showHoverTargetIndicator(hoverTarget.rect, effectiveScope);

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
      state.lastTranslatedText = hoverText;
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
    }, Math.max(
      state.hoverTranslateDelayMs,
      effectiveScope === "paragraph" ? 400 : 0,
    ));
  }

  function onMouseMove(e) {
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
    state.lastMouseTarget = e.target;
    state.lastMouseButtons = e.buttons;
    state.hoverModifierActive = isHoverModifierActive(
      e,
      state.hoverTranslateModifierKey,
    );
    updateHoverAtPoint(e.clientX, e.clientY, e.buttons, e.target);
  }

  function onPointerDownCapture(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest?.(
        `#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}, #${HOVER_TARGET_INDICATOR_ID}, #${WORD_MARKER_CARD_ID}, #ollama-pt-bar`,
      )
    ) {
      return;
    }
    const section = target.closest?.(
      "h1, h2, h3, p, blockquote, li, figcaption, article, main, [role='main']",
    );
    if (!section) return;
    // Prefer the nearest narratable block (p/h1/li…), not the whole article.
    const block =
      section.matches?.("h1, h2, h3, p, blockquote, li, figcaption")
        ? section
        : target.closest?.("h1, h2, h3, p, blockquote, li, figcaption");
    if (!block) return;
    state.narrationContentAnchor = {
      element: block,
      setAt: Date.now(),
    };
    state.lastMouseTarget = block;
  }

  function refreshHoverForModifierChange() {
    if (state.autoTranslateMode !== "hover" || !state.lastMouseTarget) return;
    clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    updateHoverAtPoint(
      state.lastMouseX,
      state.lastMouseY,
      state.lastMouseButtons,
      state.lastMouseTarget,
    );
  }

  function onKeyDown(e) {
    if (
      !isHoverModifierKeyEvent(e, state.hoverTranslateModifierKey) ||
      state.hoverModifierActive
    ) {
      return;
    }
    state.hoverModifierActive = true;
    refreshHoverForModifierChange();
  }

  function onKeyUp(e) {
    if (
      !isHoverModifierKeyEvent(e, state.hoverTranslateModifierKey) ||
      !state.hoverModifierActive
    ) {
      return;
    }
    state.hoverModifierActive = false;
    refreshHoverForModifierChange();
  }

  function onWindowBlur() {
    state.hoverModifierActive = false;
    if (state.autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
  }

  function onSelectionChangedEvent() {
    if (!isInteractionEnabled()) {
      hideButton();
      return;
    }
    if (state.autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    onSelectionChange(state.selectionPointerClickCount);
  }

  document.addEventListener("pointerdown", onPointerDownCapture, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("selectionchange", onSelectionChangedEvent, true);
  document.addEventListener("scroll", onScroll, true);
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("resize", onResize);
  window.addEventListener("blur", onWindowBlur);

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
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener(
        "selectionchange",
        onSelectionChangedEvent,
        true,
      );
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onWindowBlur);
      removeHoverTargetIndicator();
      if (btn._ollamaClickHandler) {
        btn.removeEventListener("click", btn._ollamaClickHandler);
        delete btn._ollamaClickHandler;
      }
      const style = document.getElementById(STYLE_ID);
      if (style) style.remove();
    },
  };
}
