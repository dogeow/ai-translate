import {
  refreshContextMenus,
  MENU_SETTING_KEYS,
  RADIO_MENU_SETTINGS,
  MENU_TRANSLATE_SELECTION,
  MENU_TRANSLATE_PAGE,
  MENU_CYCLE_DISPLAY_MODE,
  MENU_TOGGLE_SITE,
  MENU_REWRITE_PAGE,
  MENU_LEARN_KNOWN,
  MENU_LEARN_STUDYING,
  MENU_ENABLE_APP,
  MENU_LEARNING_MODE,
  MENU_WORD_MARKING,
  MENU_OPEN_OPTIONS,
} from "./shared/utils/contextMenu.js";
import {
  sendTranslateResult,
  openResultWindow,
  triggerVisualPageTranslate,
} from "./shared/utils/messaging.js";
import { migrateSettingsIfNeeded } from "./shared/settings.js";
import {
  toggleAlwaysTranslateOrigin,
} from "./shared/always-translate-origins.js";
import {
  translateWithProvider,
} from "./background/translationService.js";
import { handleTranslationRuntimeMessage } from "./background/translationMessageHandlers.js";
import { handleUiRewriteMessage } from "./background/uiRewriteService.js";
import { handleWordLearningMessage } from "./background/wordLearningService.js";
import { setWordLearningStatus } from "./shared/word-learning.js";
import {
  SETTING_SHORTCUT_STORAGE_KEYS,
  isSettingShortcutCommand,
  resolveSettingShortcut,
} from "./background/shortcutSettings.js";

const LOG_PREFIX = "[英语学习和AI翻译]";

// 菜单复选项与快捷键共用同一套切换逻辑（含提示与限制）
const CHECKBOX_MENU_COMMANDS = {
  [MENU_LEARNING_MODE]: "toggle-learning-mode",
  [MENU_WORD_MARKING]: "toggle-word-marking",
};

async function initializeExtensionRuntime() {
  const migration = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  if (!migration.shouldMigrate || migration.writeFailed) {
    await refreshContextMenus();
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtensionRuntime();
});

chrome.runtime.onStartup?.addListener(() => {
  void initializeExtensionRuntime();
});

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab?.id || null;
}

function sendTabMessageSafe(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (value) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(value);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function handleTranslateSelection(tabId) {
  let text = "";
  const response = await sendTabMessageSafe(tabId, {
    action: "getTextToTranslate",
  });
  if (response && (response.text || "").trim()) {
    text = response.text.trim();
  }
  if (!text) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const selection = window.getSelection();
          return selection && selection.toString().trim();
        },
      });
      text = (results[0]?.result || "").trim();
    } catch (_) {}
  }
  if (!text) {
    await sendTabMessageSafe(tabId, {
      action: "showShortcutHint",
      message: "请选中文字或将鼠标悬停在单词上",
    });
    return;
  }
  const result = await translateWithProvider(text, tabId, {
    showPending: true,
  });
  if (!result) return;
  const sent = await sendTranslateResult(tabId, result);
  if (!sent) openResultWindow();
}

async function handleTogglePageTranslate(tabId) {
  const response = await sendTabMessageSafe(tabId, {
    action: "togglePageTranslate",
  });
  if (!response?.ok && !response?.toggled) {
    // Fallback: 直接触发开始
    await triggerVisualPageTranslate(tabId);
  }
}

async function handleCycleDisplayMode(tabId) {
  await sendTabMessageSafe(tabId, { action: "cyclePageTranslateMode" });
}

async function handleToggleApp() {
  const stored = await chrome.storage.sync.get(["appEnabled"]);
  const next = stored?.appEnabled === false;
  await chrome.storage.sync.set({ appEnabled: next });
  const tabId = await getActiveTabId();
  if (tabId) {
    await sendTabMessageSafe(tabId, {
      action: "showShortcutHint",
      message: next ? "已启用 AI 翻译" : "已禁用 AI 翻译",
    });
  }
}

async function handleSettingShortcut(command, tabId) {
  const stored = await chrome.storage.sync.get(SETTING_SHORTCUT_STORAGE_KEYS);
  const result = resolveSettingShortcut(command, stored);
  if (!result) return null;
  if (result.updates) {
    await chrome.storage.sync.set(result.updates);
  }
  if (tabId && result.message) {
    await sendTabMessageSafe(tabId, {
      action: "showShortcutHint",
      message: result.message,
    });
  }
  return result;
}

async function handleToggleTranslateSite(tabId) {
  let origin = "";
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url || "");
    if (/^https?:$/.test(url.protocol)) {
      origin = `${url.protocol}//${url.host}`;
    }
  } catch (_) {}
  if (!origin) {
    await sendTabMessageSafe(tabId, {
      action: "showShortcutHint",
      message: "当前页面不支持网站自动翻译（仅 http/https）",
    });
    return;
  }
  const result = await toggleAlwaysTranslateOrigin(origin);
  if (!result.ok) return;
  if (result.enabled) {
    await sendTabMessageSafe(tabId, {
      action: "showShortcutHint",
      message: `已加入自动翻译：${origin}`,
    });
    // 立即翻译当前页
    await triggerVisualPageTranslate(tabId);
  } else {
    await sendTabMessageSafe(tabId, {
      action: "showShortcutHint",
      message: `已移出自动翻译：${origin}`,
    });
  }
}

async function handleTranslatePageBilingual(tabId) {
  await sendTabMessageSafe(tabId, {
    action: "setPageTranslateMode",
    mode: "bilingual",
  });
  const response = await triggerVisualPageTranslate(tabId);
  if (!response?.ok) {
    console.warn(LOG_PREFIX, "双语翻译启动失败:", response?.error);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  console.log(LOG_PREFIX, "command received:", command);
  try {
    if (command === "open-options") {
      await chrome.runtime.openOptionsPage();
      return;
    }
    if (command === "toggle-app") {
      await handleToggleApp();
      return;
    }
    const tabId = await getActiveTabId();
    if (isSettingShortcutCommand(command)) {
      await handleSettingShortcut(command, tabId);
      return;
    }
    if (!tabId) {
      console.warn(LOG_PREFIX, "no active tab id");
      return;
    }
    if (command === "translate-selection") {
      await handleTranslateSelection(tabId);
      return;
    }
    if (command === "toggle-page-translate") {
      await handleTogglePageTranslate(tabId);
      return;
    }
    if (command === "cycle-display-mode") {
      await handleCycleDisplayMode(tabId);
      return;
    }
    if (command === "translate-page-bilingual") {
      await handleTranslatePageBilingual(tabId);
      return;
    }
    if (command === "toggle-translate-site") {
      await handleToggleTranslateSite(tabId);
      return;
    }
  } catch (e) {
    console.error(LOG_PREFIX, "Hotkey error:", e);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, clickedTab) => {
  const menuConfig = RADIO_MENU_SETTINGS[info.menuItemId];
  if (menuConfig) {
    await chrome.storage.sync.set({ [menuConfig.key]: menuConfig.value });
    return;
  }

  const checkboxCommand = CHECKBOX_MENU_COMMANDS[info.menuItemId];
  if (checkboxCommand) {
    const result = await handleSettingShortcut(checkboxCommand, clickedTab?.id);
    // 设置未改变时（例如被拒绝），复选框需要恢复为真实状态
    if (!result?.updates) void refreshContextMenus();
    return;
  }

  if (info.menuItemId === MENU_OPEN_OPTIONS) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  if (info.menuItemId === MENU_ENABLE_APP) {
    await chrome.storage.sync.set({ appEnabled: true });
    return;
  }

  if (info.menuItemId === MENU_CYCLE_DISPLAY_MODE) {
    if (clickedTab?.id) await handleCycleDisplayMode(clickedTab.id);
    return;
  }

  if (info.menuItemId === MENU_TOGGLE_SITE) {
    if (clickedTab?.id) await handleToggleTranslateSite(clickedTab.id);
    return;
  }

  if (info.menuItemId === MENU_REWRITE_PAGE) {
    const tabId = clickedTab?.id;
    if (tabId) {
      try {
        chrome.tabs.sendMessage(
          tabId,
          { action: "openUiRewritePrompt" },
          () => {
            void chrome.runtime.lastError;
          },
        );
      } catch (_) {}
    }
    return;
  }

  if (
    info.menuItemId === MENU_LEARN_KNOWN ||
    info.menuItemId === MENU_LEARN_STUDYING
  ) {
    const word = String(info.selectionText || "").trim();
    if (!word) return;
    const tabId = clickedTab?.id;
    if (info.menuItemId === MENU_LEARN_KNOWN) {
      const result = await setWordLearningStatus(word, "known");
      if (tabId) {
        sendTabMessageSafe(tabId, {
          action: "showShortcutHint",
          message: result
            ? `已入「我知道的单词」：${result.word}`
            : "不是有效的英文单词",
        });
        sendTabMessageSafe(tabId, { action: "wordsChanged" });
      }
    } else {
      const result = await setWordLearningStatus(word, "studying");
      if (tabId) {
        sendTabMessageSafe(tabId, {
          action: "showShortcutHint",
          message: result
            ? `已加入生词：${result.word}`
            : "不是有效的英文单词",
        });
        sendTabMessageSafe(tabId, { action: "wordsChanged" });
      }
    }
    return;
  }

  const clickedTabId = clickedTab?.id;
  if (info.menuItemId === MENU_TRANSLATE_PAGE) {
    const response = await triggerVisualPageTranslate(clickedTabId);
    if (!response?.ok) {
      console.warn(
        LOG_PREFIX,
        "右键菜单触发页面翻译失败:",
        response?.error || "unknown_error",
      );
    }
    return;
  }

  if (info.menuItemId !== MENU_TRANSLATE_SELECTION || !info.selectionText) {
    return;
  }

  const text = info.selectionText.trim();
  let tabId = clickedTabId;
  if (!tabId) {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabId = tab?.id;
  }
  try {
    const result = await translateWithProvider(text, tabId, {
      showPending: true,
    });
    if (!result) return;
    if (tabId) {
      const sent = await sendTranslateResult(tabId, result);
      if (sent) return;
    }
    openResultWindow();
  } catch (_) {}
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (!MENU_SETTING_KEYS.some((key) => key in changes)) return;
  void refreshContextMenus();
});

const UI_REWRITE_ACTIONS = new Set([
  "generateUiRewrite",
  "getUiRewrites",
  "getUiRewriteForUrl",
  "setUiRewriteActiveVersion",
  "deleteUiRewriteVersion",
  "deleteUiRewriteRule",
  "updateUiRewriteRule",
]);

const WORD_LEARNING_ACTIONS = new Set([
  "lookupWord",
  "getAllWords",
  "getKnownWords",
  "getStudyingWords",
  "importWordLearningData",
  "getWordLearningStatus",
  "setWordLearningStatus",
  "addKnownWord",
  "removeKnownWord",
  "addStudyingWord",
  "removeStudyingWord",
  "reviewWord",
]);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && UI_REWRITE_ACTIONS.has(msg.action)) {
    handleUiRewriteMessage(msg, sender)
      .then((res) => sendResponse(res || { ok: false, error: "unknown_action" }))
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || String(err) }),
      );
    return true;
  }
  if (msg && WORD_LEARNING_ACTIONS.has(msg.action)) {
    handleWordLearningMessage(msg)
      .then((res) => sendResponse(res || { ok: false, error: "unknown_action" }))
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || String(err) }),
      );
    return true;
  }

  if (handleTranslationRuntimeMessage(msg, sender, sendResponse)) {
    return true;
  }

  return false;
});
