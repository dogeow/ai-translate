import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
  PROVIDER_CHROME_AI,
} from "../shared/constants.js";
import {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
} from "../shared/settings.js";
import {
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
} from "../shared/word-learning.js";

export const SETTING_SHORTCUT_COMMANDS = Object.freeze([
  "cycle-auto-translate-mode",
  "toggle-hover-translate-scope",
  "toggle-learning-mode",
  "toggle-word-marking",
  "toggle-word-recognition-mode",
]);

export const SETTING_SHORTCUT_STORAGE_KEYS = Object.freeze([
  "autoTranslateMode",
  "hoverTranslateScope",
  "learningModeEnabled",
  "provider",
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
]);

const SETTING_SHORTCUT_COMMAND_SET = new Set(SETTING_SHORTCUT_COMMANDS);
const AUTO_TRANSLATE_MODES = AUTO_TRANSLATE_MODE_OPTIONS.map(
  (option) => option.value,
);
const AUTO_TRANSLATE_MODE_LABELS = Object.fromEntries(
  AUTO_TRANSLATE_MODE_OPTIONS.map((option) => [option.value, option.title]),
);
const HOVER_TRANSLATE_SCOPES = HOVER_TRANSLATE_SCOPE_OPTIONS.map(
  (option) => option.value,
);
const HOVER_TRANSLATE_SCOPE_LABELS = Object.fromEntries(
  HOVER_TRANSLATE_SCOPE_OPTIONS.map((option) => [option.value, option.title]),
);

function getNextValue(values, current) {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

function resolveBooleanToggle(stored, key, label) {
  const next = stored?.[key] !== true;
  return {
    updates: { [key]: next },
    message: `${label}已${next ? "开启" : "关闭"}`,
  };
}

export function isSettingShortcutCommand(command) {
  return SETTING_SHORTCUT_COMMAND_SET.has(command);
}

export function resolveSettingShortcut(command, stored = {}) {
  if (command === "cycle-auto-translate-mode") {
    const current = normalizeAutoTranslateMode(stored.autoTranslateMode);
    const next = getNextValue(AUTO_TRANSLATE_MODES, current);
    return {
      updates: { autoTranslateMode: next },
      message: `取词模式：${AUTO_TRANSLATE_MODE_LABELS[next]}`,
    };
  }

  if (command === "toggle-hover-translate-scope") {
    const current = normalizeHoverTranslateScope(stored.hoverTranslateScope);
    const next = getNextValue(HOVER_TRANSLATE_SCOPES, current);
    return {
      updates: { hoverTranslateScope: next },
      message: `悬停翻译范围：${HOVER_TRANSLATE_SCOPE_LABELS[next]}`,
    };
  }

  if (command === "toggle-learning-mode") {
    const next = stored.learningModeEnabled !== true;
    if (next && stored.provider === PROVIDER_CHROME_AI) {
      return {
        updates: null,
        message: "Chrome 内置 AI 不支持学习模式",
      };
    }
    return {
      updates: { learningModeEnabled: next },
      message: `学习模式已${next ? "开启" : "关闭"}`,
    };
  }

  if (command === "toggle-word-marking") {
    return resolveBooleanToggle(
      stored,
      WORD_MARKING_ENABLED_KEY,
      "生词标记",
    );
  }

  if (command === "toggle-word-recognition-mode") {
    return resolveBooleanToggle(
      stored,
      WORD_RECOGNITION_MODE_ENABLED_KEY,
      "认词模式",
    );
  }

  return null;
}
