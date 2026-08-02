/**
 * 滑词翻译 content script 运行时
 * 负责配置同步与子模块装配。
 */
import { hideButton } from "./button.js";
import { showShortcutHint } from "./shortcutHint.js";
import { hideTip } from "./tip.js";
import { createPageTranslateBridge } from "./pageTranslateBridge.js";
import { createPageTranslateBar } from "./pageTranslateBar.js";
import { createInteractionController } from "./interactionController.js";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_MODIFIER_KEY,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  DEFAULT_APP_ENABLED,
} from "../shared/constants.js";
import {
  migrateSettingsIfNeeded,
  normalizeAllSettings,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateModifierKey,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
} from "../shared/settings.js";
import {
  logDebug,
  sendMessageSafe,
} from "./runtimeShared.js";
import { isChineseIdentifierText } from "../shared/translation-language.js";
import {
  BUTTON_ID,
  HOVER_TARGET_INDICATOR_ID,
  SHORTCUT_HINT_ID,
  TIP_ID,
  WORD_MARKER_CARD_ID,
} from "./constants.js";
import {
  ALWAYS_TRANSLATE_ORIGINS_KEY,
} from "../shared/constants.js";
import {
  isAlwaysTranslateOrigin,
} from "../shared/always-translate-origins.js";
import { initUiRewrite } from "./uiRewrite.js";
import { initWordMarker } from "./wordMarker.js";
import {
  ARTICLE_NARRATION_ACCENT_KEY,
  ARTICLE_NARRATION_MODE_KEY,
  ARTICLE_NARRATION_RATE_KEY,
  ARTICLE_NARRATION_SETTING_KEYS,
  createArticleNarrator,
} from "./articleNarration.js";

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
    appEnabled: DEFAULT_APP_ENABLED,
    lastTipRect: null,
    lastMouseX: 0,
    lastMouseY: 0,
    lastMouseTarget: null,
    /** Last content section the user pointed at (click), for narration start. */
    narrationContentAnchor: null,
    lastMouseButtons: 0,
    lastTranslatedElement: null,
    lastTranslatedText: "",
    autoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
    translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
    hoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
    hoverTranslateModifierKey: DEFAULT_HOVER_TRANSLATE_MODIFIER_KEY,
    hoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
    selectionAutoTranslateTimerId: null,
    selectionPointerClickCount: 0,
    selectionButtonWordRect: null,
    hoverAutoTranslateTimerId: null,
    hoverCurrentKey: "",
    hoverPendingKey: "",
    hoverInFlightKey: "",
    hoverLastResolvedKey: "",
    activeHoverRequestId: "",
    lastCompletedHoverRequestId: "",
    hoverRequestSeq: 0,
    hoverModifierActive: false,
    activeTipRequestId: "",
    dismissedTipRequestId: "",
    pageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
    pageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  };
  function shouldSkipHoverTranslate(text) {
    return isChineseIdentifierText(text);
  }

  function shouldSkipPageTranslate(text) {
    return isChineseIdentifierText(text);
  }

  const pageTranslator = createPageTranslateBridge({
    sendMessageSafe,
    showShortcutHint,
    shouldSkipText: shouldSkipPageTranslate,
    isUiElement: (element) =>
      !!(
        element &&
        element.closest &&
        element.closest(
          `#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}, #${HOVER_TARGET_INDICATOR_ID}, #${WORD_MARKER_CARD_ID}, #ollama-pt-bar`,
        )
      ),
    initialOptions: {
      maxConcurrent: state.pageTranslateConcurrency,
      batchChars: state.pageTranslateBatchChars,
      translationContext: state.translateTargetLang,
    },
  });

  const articleNarrator = createArticleNarrator({
    root: document.body,
    getStartElement: () => {
      const anchor = state.narrationContentAnchor;
      if (
        anchor?.element?.isConnected &&
        Date.now() - (anchor.setAt || 0) < 5 * 60 * 1000
      ) {
        return anchor.element;
      }
      return state.lastMouseTarget;
    },
    isUiElement: (element) =>
      !!element?.closest?.(
        `#${BUTTON_ID}, #${TIP_ID}, #${SHORTCUT_HINT_ID}, #${HOVER_TARGET_INDICATOR_ID}, #${WORD_MARKER_CARD_ID}, #ollama-pt-bar`,
      ),
    onOptionsChange: ({ mode, rate, accent }) => {
      chrome.storage.sync.set({
        [ARTICLE_NARRATION_MODE_KEY]: mode,
        [ARTICLE_NARRATION_RATE_KEY]: rate,
        [ARTICLE_NARRATION_ACCENT_KEY]: accent,
      });
    },
  });

  chrome.storage.sync.get(ARTICLE_NARRATION_SETTING_KEYS, (values) => {
    articleNarrator.setOptions(
      {
        mode: values?.[ARTICLE_NARRATION_MODE_KEY],
        rate: values?.[ARTICLE_NARRATION_RATE_KEY],
        accent: values?.[ARTICLE_NARRATION_ACCENT_KEY],
      },
      { restart: false },
    );
  });

  const pageTranslateBar = createPageTranslateBar(
    pageTranslator,
    articleNarrator,
  );
  const originalStart = pageTranslator.start;
  const originalStop = pageTranslator.stop;
  pageTranslator.start = () => {
    originalStart();
    pageTranslateBar.show();
  };
  pageTranslator.stop = () => {
    originalStop();
    pageTranslateBar.hide();
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action !== "chromeAiDownloadProgress") return;
    if (typeof msg.loaded === "number" && pageTranslator.isActive()) {
      pageTranslateBar.setDownloadProgress(msg.loaded);
    }
  });

  const interactionController = createInteractionController({
    state,
    pageTranslator,
    articleNarrator,
    shouldSkipHoverTranslate,
  });

  function applyAutoTranslateSettings(cfg) {
    const normalized = normalizeAllSettings(cfg);
    state.appEnabled = cfg?.appEnabled !== false;
    state.autoTranslateMode = normalizeAutoTranslateMode(
      normalized.autoTranslateMode,
    );
    state.translateTargetLang =
      normalized.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG;
    state.hoverTranslateScope = normalizeHoverTranslateScope(
      normalized.hoverTranslateScope,
    );
    state.hoverTranslateModifierKey = normalizeHoverTranslateModifierKey(
      normalized.hoverTranslateModifierKey,
    );
    state.hoverModifierActive = false;
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
      translationContext: state.translateTargetLang,
    });
    interactionController.clearSelectionAutoTranslateTimer();
    interactionController.clearHoverAutoTranslateTimer({
      preserveLastResolved: true,
    });
    if (!state.appEnabled) {
      pageTranslator.stop();
      articleNarrator.stop();
      hideButton();
      hideTip();
      return;
    }
    if (state.autoTranslateMode !== "hotkey") hideButton();
  }

  async function loadAutoTranslateSettings() {
    const { settings } = await migrateSettingsIfNeeded(
      getAllSyncSettings,
      setAllSyncSettings,
    );
    applyAutoTranslateSettings(settings);
  }

  async function maybeAutoStartForAllowedOrigin() {
    if (!state.appEnabled) return;
    if (pageTranslator.isActive()) return;
    try {
      const here = `${window.location.protocol}//${window.location.host}`;
      const allowed = await isAlwaysTranslateOrigin(here);
      if (!allowed) return;
      if (!state.appEnabled || pageTranslator.isActive()) return;
      pageTranslator.start();
    } catch (_) {}
  }

  void loadAutoTranslateSettings().then(() => maybeAutoStartForAllowedOrigin());

  const cleanupUiRewrite = initUiRewrite();
  const cleanupWordMarker = initWordMarker({
    onRecognitionStatsChange: (stats) => {
      pageTranslateBar.setRecognitionStats(stats);
    },
  });

  function onStorageChanged(changes, area) {
    if (area !== "sync") return;
    if (ARTICLE_NARRATION_SETTING_KEYS.some((key) => key in changes)) {
      articleNarrator.setOptions(
        {
          mode: changes[ARTICLE_NARRATION_MODE_KEY]?.newValue,
          rate: changes[ARTICLE_NARRATION_RATE_KEY]?.newValue,
          accent: changes[ARTICLE_NARRATION_ACCENT_KEY]?.newValue,
        },
        { restart: false },
      );
    }
    if (ALWAYS_TRANSLATE_ORIGINS_KEY in changes) {
      void maybeAutoStartForAllowedOrigin();
    }
    if (
      !("appEnabled" in changes) &&
      !("autoTranslateMode" in changes) &&
      !("ollamaAutoTranslateMode" in changes) &&
      !("ollamaAutoTranslateSelection" in changes) &&
      !("translateTargetLang" in changes) &&
      !("hoverTranslateScope" in changes) &&
      !("ollamaHoverTranslateScope" in changes) &&
      !("hoverTranslateModifierKey" in changes) &&
      !("ollamaHoverTranslateModifierKey" in changes) &&
      !("hoverTranslateDelayMs" in changes) &&
      !("ollamaHoverTranslateDelayMs" in changes) &&
      !("pageTranslateConcurrency" in changes) &&
      !("ollamaPageTranslateConcurrency" in changes) &&
      !("pageTranslateBatchChars" in changes) &&
      !("ollamaPageTranslateBatchChars" in changes)
    ) {
      return;
    }

    void loadAutoTranslateSettings();
  }

  chrome.storage.onChanged.addListener(onStorageChanged);

  return function cleanup() {
    interactionController.cleanup();
    chrome.storage.onChanged.removeListener(onStorageChanged);
    try { cleanupUiRewrite?.(); } catch (_) {}
    try { cleanupWordMarker?.(); } catch (_) {}
    articleNarrator.destroy();
    pageTranslateBar.destroy();
  };
}

export { logDebug };
