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
  migrateSettingsIfNeeded,
  normalizeAllSettings,
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
    const normalized = normalizeAllSettings(cfg);
    state.autoTranslateMode = normalizeAutoTranslateMode(
      normalized.autoTranslateMode,
    );
    state.translateTargetLang =
      normalized.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG;
    state.hoverTranslateScope = normalizeHoverTranslateScope(
      normalized.hoverTranslateScope,
    );
    state.hoverTranslateDelayMs = normalizeHoverTranslateDelayMs(
      normalized.hoverTranslateDelayMs,
    );
    state.pageTranslateConcurrency = normalizePageTranslateConcurrency(
      normalized.pageTranslateConcurrency,
    );
    state.pageTranslateBatchChars = normalizePageTranslateBatchChars(
      normalized.pageTranslateBatchChars,
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

  async function loadAutoTranslateSettings() {
    const { settings } = await migrateSettingsIfNeeded(
      getAllSyncSettings,
      setAllSyncSettings,
    );
    applyAutoTranslateSettings(settings);
  }

  void loadAutoTranslateSettings();

  function onStorageChanged(changes, area) {
    if (area !== "sync") return;
    if (
      !("autoTranslateMode" in changes) &&
      !("ollamaAutoTranslateMode" in changes) &&
      !("ollamaAutoTranslateSelection" in changes) &&
      !("translateTargetLang" in changes) &&
      !("hoverTranslateScope" in changes) &&
      !("ollamaHoverTranslateScope" in changes) &&
      !("hoverTranslateDelayMs" in changes) &&
      !("ollamaHoverTranslateDelayMs" in changes) &&
      !("pageTranslateConcurrency" in changes) &&
      !("ollamaPageTranslateConcurrency" in changes) &&
      !("pageTranslateBatchChars" in changes)
      && !("ollamaPageTranslateBatchChars" in changes)
    ) {
      return;
    }

    void loadAutoTranslateSettings();
  }

  chrome.storage.onChanged.addListener(onStorageChanged);

  return function cleanup() {
    interactionController.cleanup();
    chrome.storage.onChanged.removeListener(onStorageChanged);
  };
}

export { logDebug };
