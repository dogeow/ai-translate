/** 滑词翻译 content script 使用的 DOM ID 常量 */

export const BUTTON_ID = "ai-translate-hover-btn";
export const TIP_ID = "ai-translate-tip";
export const STYLE_ID = "ai-translate-hover-styles";
export const SHORTCUT_HINT_ID = "ai-translate-shortcut-hint";
export const HOVER_TARGET_INDICATOR_ID = "ai-translate-hover-target";
export const WORD_MARKER_CARD_ID = "__ai_translate_word_card__";
export const WORD_MARKER_SPAN_CLASS = "ai-tr-word";

// TARGET_LANG_LABELS 已迁移至 shared/constants.js
export { TARGET_LANG_LABELS } from "../shared/constants.js";

/** 检查应用是否启用 */
export async function isAppEnabled() {
  try {
    const value = await chrome.storage.sync.get("appEnabled");
    return value.appEnabled !== false;
  } catch {
    return true;
  }
}
