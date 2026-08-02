/**
 * Context menu management for browser extension
 */

import {
  getPopupSettingsState,
  migrateSettingsIfNeeded,
} from "../settings.js";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
} from "../constants.js";

// Context menu IDs
export const MENU_TRANSLATE_SELECTION = "ai-translate";
export const MENU_TRANSLATE_PAGE = "ai-translate-page";
export const MENU_OPEN_OPTIONS = "ollama-open-options";
export const MENU_AUTO_MODE_PARENT = "ollama-auto-translate-mode";
export const MENU_AUTO_MODE_HOTKEY = "ollama-auto-translate-mode-hotkey";
export const MENU_AUTO_MODE_SELECTION = "ollama-auto-translate-mode-selection";
export const MENU_AUTO_MODE_HOVER = "ollama-auto-translate-mode-hover";
export const MENU_HOVER_SCOPE_PARENT = "ollama-hover-translate-scope";
export const MENU_HOVER_SCOPE_WORD = "ollama-hover-translate-scope-word";
export const MENU_HOVER_SCOPE_PARAGRAPH =
  "ollama-hover-translate-scope-paragraph";

/**
 * Read menu-related settings from Chrome storage
 * @returns {Promise<{autoTranslateMode: string, hoverTranslateScope: string, hoverTranslateModifierKey: string, learningModeEnabled: boolean, appEnabled: boolean}>}
 */
export function getMenuSettingsState(stored = {}) {
  return getPopupSettingsState(stored);
}

export async function readMenuSettings() {
  const { settings } = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  return getMenuSettingsState(settings);
}

/**
 * Create all context menus with current settings
 * @returns {Promise<void>}
 */
export async function createContextMenus() {
  const { autoTranslateMode, hoverTranslateScope, appEnabled } =
    await readMenuSettings();

  await chrome.contextMenus.removeAll();

  if (!appEnabled) {
    chrome.contextMenus.create({
      id: MENU_OPEN_OPTIONS,
      title: "打开设置",
      contexts: ["action"],
    });
    return;
  }

  chrome.contextMenus.create({
    id: MENU_TRANSLATE_SELECTION,
    title: "英语学习和AI翻译选中内容",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: MENU_TRANSLATE_PAGE,
    title: "英语学习和AI翻译整个页面（可视区域优先）",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: MENU_OPEN_OPTIONS,
    title: "打开设置",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_AUTO_MODE_PARENT,
    title: "自动翻译模式",
    contexts: ["action"],
  });

  // 动态创建自动翻译模式菜单项
  const autoModeMenuIds = {
    hotkey: MENU_AUTO_MODE_HOTKEY,
    selection: MENU_AUTO_MODE_SELECTION,
    hover: MENU_AUTO_MODE_HOVER,
  };

  AUTO_TRANSLATE_MODE_OPTIONS.forEach((option) => {
    chrome.contextMenus.create({
      id: autoModeMenuIds[option.value],
      parentId: MENU_AUTO_MODE_PARENT,
      title: option.title,
      type: "radio",
      checked: autoTranslateMode === option.value,
      contexts: ["action"],
    });
  });

  chrome.contextMenus.create({
    id: MENU_HOVER_SCOPE_PARENT,
    title: "悬停翻译范围",
    contexts: ["action"],
  });

  // 动态创建悬停范围菜单项
  const hoverScopeMenuIds = {
    word: MENU_HOVER_SCOPE_WORD,
    paragraph: MENU_HOVER_SCOPE_PARAGRAPH,
  };

  HOVER_TRANSLATE_SCOPE_OPTIONS.forEach((option) => {
    chrome.contextMenus.create({
      id: hoverScopeMenuIds[option.value],
      parentId: MENU_HOVER_SCOPE_PARENT,
      title: option.title,
      type: "radio",
      checked: hoverTranslateScope === option.value,
      contexts: ["action"],
    });
  });
}
