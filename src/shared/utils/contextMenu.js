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
import { WORD_MARKING_ENABLED_KEY } from "../word-learning.js";

// Context menu IDs
export const MENU_TRANSLATE_SELECTION = "ai-translate";
export const MENU_LEARN_STUDYING = "ai-translate-learn-studying";
export const MENU_LEARN_KNOWN = "ai-translate-learn-known";
export const MENU_TRANSLATE_PAGE = "ai-translate-page";
export const MENU_CYCLE_DISPLAY_MODE = "ai-translate-cycle-display-mode";
export const MENU_TOGGLE_SITE = "ai-translate-toggle-site";
export const MENU_REWRITE_PAGE = "ai-translate-rewrite-page";
export const MENU_PAGE_SEPARATOR = "ai-translate-page-separator";
export const MENU_ENABLE_APP = "ai-translate-enable-app";
export const MENU_LEARNING_MODE = "ai-translate-learning-mode";
export const MENU_WORD_MARKING = "ai-translate-word-marking";
export const MENU_OPEN_OPTIONS = "ollama-open-options";
export const MENU_AUTO_MODE_PARENT = "ollama-auto-translate-mode";
export const MENU_AUTO_MODE_HOTKEY = "ollama-auto-translate-mode-hotkey";
export const MENU_AUTO_MODE_SELECTION = "ollama-auto-translate-mode-selection";
export const MENU_AUTO_MODE_HOVER = "ollama-auto-translate-mode-hover";
export const MENU_HOVER_SCOPE_PARENT = "ollama-hover-translate-scope";
export const MENU_HOVER_SCOPE_WORD = "ollama-hover-translate-scope-word";
export const MENU_HOVER_SCOPE_PARAGRAPH =
  "ollama-hover-translate-scope-paragraph";

// 改变后需要重建菜单的存储键（含旧版键，迁移时也会触发）
export const MENU_SETTING_KEYS = Object.freeze([
  "appEnabled",
  "autoTranslateMode",
  "hoverTranslateScope",
  "learningModeEnabled",
  WORD_MARKING_ENABLED_KEY,
  "ollamaAutoTranslateMode",
  "ollamaAutoTranslateSelection",
  "ollamaHoverTranslateScope",
]);

const AUTO_MODE_MENU_IDS = {
  hotkey: MENU_AUTO_MODE_HOTKEY,
  selection: MENU_AUTO_MODE_SELECTION,
  hover: MENU_AUTO_MODE_HOVER,
};

const HOVER_SCOPE_MENU_IDS = {
  word: MENU_HOVER_SCOPE_WORD,
  paragraph: MENU_HOVER_SCOPE_PARAGRAPH,
};

// 菜单点击后直接写入的单选设置
export const RADIO_MENU_SETTINGS = Object.freeze({
  ...Object.fromEntries(
    Object.entries(AUTO_MODE_MENU_IDS).map(([value, id]) => [
      id,
      { key: "autoTranslateMode", value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(HOVER_SCOPE_MENU_IDS).map(([value, id]) => [
      id,
      { key: "hoverTranslateScope", value },
    ]),
  ),
});

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
  return {
    ...getMenuSettingsState(settings),
    wordMarkingEnabled: settings?.[WORD_MARKING_ENABLED_KEY] === true,
  };
}

/**
 * 根据当前设置生成菜单定义（纯函数，便于测试）。
 * 注意：扩展图标（action）右键菜单的顶层项最多 6 个。
 */
export function buildContextMenuItems({
  appEnabled = true,
  autoTranslateMode,
  hoverTranslateScope,
  learningModeEnabled = false,
  wordMarkingEnabled = false,
} = {}) {
  if (!appEnabled) {
    return [
      { id: MENU_ENABLE_APP, title: "启用 AI 翻译", contexts: ["action"] },
      { id: MENU_OPEN_OPTIONS, title: "打开设置", contexts: ["action"] },
    ];
  }

  return [
    // 选中文字
    {
      id: MENU_TRANSLATE_SELECTION,
      title: "翻译「%s」",
      contexts: ["selection"],
    },
    {
      id: MENU_LEARN_STUDYING,
      title: "加入生词本（学习中）",
      contexts: ["selection"],
    },
    {
      id: MENU_LEARN_KNOWN,
      title: "标记为认识的单词",
      contexts: ["selection"],
    },
    // 页面
    {
      id: MENU_TRANSLATE_PAGE,
      title: "翻译此页面（可视区域优先）",
      contexts: ["page"],
    },
    {
      id: MENU_CYCLE_DISPLAY_MODE,
      title: "切换显示：译文 → 原文 → 双语",
      contexts: ["page"],
    },
    {
      id: MENU_TOGGLE_SITE,
      title: "始终翻译此网站（开 / 关）",
      contexts: ["page"],
    },
    { id: MENU_PAGE_SEPARATOR, type: "separator", contexts: ["page"] },
    {
      id: MENU_REWRITE_PAGE,
      title: "AI 改造这个页面…",
      contexts: ["page", "action"],
    },
    // 扩展图标
    { id: MENU_AUTO_MODE_PARENT, title: "取词方式", contexts: ["action"] },
    ...AUTO_TRANSLATE_MODE_OPTIONS.map((option) => ({
      id: AUTO_MODE_MENU_IDS[option.value],
      parentId: MENU_AUTO_MODE_PARENT,
      title: option.title,
      type: "radio",
      checked: autoTranslateMode === option.value,
      contexts: ["action"],
    })),
    {
      id: MENU_HOVER_SCOPE_PARENT,
      title: "悬停翻译范围",
      contexts: ["action"],
      // 只有悬停模式下这个设置才生效
      enabled: autoTranslateMode === "hover",
    },
    ...HOVER_TRANSLATE_SCOPE_OPTIONS.map((option) => ({
      id: HOVER_SCOPE_MENU_IDS[option.value],
      parentId: MENU_HOVER_SCOPE_PARENT,
      title: option.title,
      type: "radio",
      checked: hoverTranslateScope === option.value,
      contexts: ["action"],
    })),
    {
      id: MENU_LEARNING_MODE,
      title: "句式分析",
      type: "checkbox",
      checked: learningModeEnabled === true,
      contexts: ["action"],
    },
    {
      id: MENU_WORD_MARKING,
      title: "生词标记",
      type: "checkbox",
      checked: wordMarkingEnabled === true,
      contexts: ["action"],
    },
    { id: MENU_OPEN_OPTIONS, title: "打开设置", contexts: ["action"] },
  ];
}

function createMenuItem(item) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(item, () => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[英语学习和AI翻译] 创建菜单失败:",
          item.id,
          chrome.runtime.lastError.message,
        );
      }
      resolve();
    });
  });
}

/**
 * Create all context menus with current settings
 * @returns {Promise<void>}
 */
export async function createContextMenus() {
  const state = await readMenuSettings();
  await chrome.contextMenus.removeAll();
  for (const item of buildContextMenuItems(state)) {
    await createMenuItem(item);
  }
}

let rebuildChain = Promise.resolve();
let rebuildQueued = false;

/**
 * 串行重建菜单：并发调用 removeAll/create 会产生重复 ID 错误；
 * 排队期间的多次请求合并为一次。
 */
export function refreshContextMenus() {
  if (rebuildQueued) return rebuildChain;
  rebuildQueued = true;
  rebuildChain = rebuildChain
    .then(() => {
      rebuildQueued = false;
      return createContextMenus();
    })
    .catch((error) => {
      console.warn("[英语学习和AI翻译] 重建菜单失败:", error);
    });
  return rebuildChain;
}
