/**
 * 滑词翻译 content script 运行时
 * 负责配置同步与子模块装配。
 */
import { hideButton } from "./button.js";
import { showShortcutHint } from "./shortcutHint.js";
import { createPageTranslateBridge } from "./pageTranslateBridge.js";
import { createInteractionController } from "./interactionController.js";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
} from "../shared/constants.js";
import {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
} from "../shared/settings.js";
import {
  createChineseTextGuards,
  logDebug,
  sendMessageSafe,
} from "./runtimeShared.js";
import { BUTTON_ID, SHORTCUT_HINT_ID, TIP_ID } from "./constants.js";

export function initContentRuntime() {
  const state = {
    lastTipRect: null,
    lastMouseX: 0,
    lastMouseY: 0,
    lastTranslatedElement: null,
    autoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
    translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
    hoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
    hoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
    selectionAutoTranslateTimerId: null,
    hoverAutoTranslateTimerId: null,
    hoverCurrentKey: "",
    hoverPendingKey: "",
    hoverInFlightKey: "",
    hoverLastResolvedKey: "",
    activeHoverRequestId: "",
    lastCompletedHoverRequestId: "",
    hoverRequestSeq: 0,
    activeTipRequestId: "",
    dismissedTipRequestId: "",
    pageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
    pageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  };
  const { isMostlyChineseText, isChineseIdentifierText } =
    createChineseTextGuards();

  function shouldSkipHoverTranslate(text) {
    if (isChineseIdentifierText(text)) return true;
    return state.translateTargetLang === "Chinese" && isMostlyChineseText(text);
  }

  function shouldSkipPageTranslate(text) {
    if (isChineseIdentifierText(text)) return true;
    return state.translateTargetLang === "Chinese" && isMostlyChineseText(text);
  }

  const pageTranslator = createPageTranslateBridge({
    sendMessageSafe,
    showShortcutHint,
    shouldSkipText: shouldSkipPageTranslate,
    isUiElement: (element) =>
      !!(
        element &&
        element.closest &&
        element.closest(`#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}`)
      ),
    initialOptions: {
      maxConcurrent: state.pageTranslateConcurrency,
      batchChars: state.pageTranslateBatchChars,
    },
  });

  const interactionController = createInteractionController({
    state,
    pageTranslator,
    shouldSkipHoverTranslate,
  });

  function applyAutoTranslateSettings(cfg) {
    state.autoTranslateMode = normalizeAutoTranslateMode(
      cfg.ollamaAutoTranslateMode,
      cfg.ollamaAutoTranslateSelection,
    );
    state.translateTargetLang =
      cfg.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG;
    state.hoverTranslateScope = normalizeHoverTranslateScope(
      cfg.ollamaHoverTranslateScope,
    );
    state.hoverTranslateDelayMs = normalizeHoverTranslateDelayMs(
      cfg.ollamaHoverTranslateDelayMs,
    );
    state.pageTranslateConcurrency = normalizePageTranslateConcurrency(
      cfg.ollamaPageTranslateConcurrency,
    );
    state.pageTranslateBatchChars = normalizePageTranslateBatchChars(
      cfg.ollamaPageTranslateBatchChars,
    );
    pageTranslator.updateOptions({
      maxConcurrent: state.pageTranslateConcurrency,
      batchChars: state.pageTranslateBatchChars,
    });
    if (state.autoTranslateMode !== "hotkey") hideButton();
    interactionController.clearSelectionAutoTranslateTimer();
    interactionController.clearHoverAutoTranslateTimer({
      preserveLastResolved: true,
    });
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

  return function cleanup() {
    interactionController.cleanup();
    chrome.storage.onChanged.removeListener(onStorageChanged);
  };
}

export { logDebug };
