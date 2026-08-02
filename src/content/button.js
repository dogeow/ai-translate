/** 悬浮「翻译」按钮：显示、隐藏与点击 */
import { BUTTON_ID, isAppEnabled } from "./constants.js";
import { injectStyles } from "./styles.js";
import { getSelectionRect, getSelectionText } from "./selection.js";

/** 若不存在则创建并返回按钮元素，供 content 绑定一次点击事件 */
export function getButtonElement() {
  let btn = document.getElementById(BUTTON_ID);
  if (!btn) {
    injectStyles();
    btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.style.display = "none";
    btn.textContent = "翻译";
    document.body.appendChild(btn);
  }
  return btn;
}

export function showButton(text, anchorRect = null) {
  const btn = getButtonElement();
  const rect = anchorRect || getSelectionRect();
  if (!rect) return null;
  const pad = 4;
  btn.style.top = `${rect.bottom + pad + window.scrollY}px`;
  btn.style.left = `${rect.left + window.scrollX}px`;
  btn.style.display = "block";
  btn.dataset.text = text;
  return rect;
}

export function hideButton() {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) btn.style.display = "none";
}

/** 从按钮 dataset 或当前选区取待翻译文本 */
export function getButtonOrSelectionText() {
  const btn = document.getElementById(BUTTON_ID);
  return (btn && btn.dataset.text) || getSelectionText();
}

/** 显示按钮前检查应用是否启用 */
export function showButtonIfEnabled(text) {
  return isAppEnabled().then((enabled) => {
    if (!enabled) return null;
    return showButton(text);
  });
}

/** 隐藏按钮前检查应用是否启用 */
export function hideButtonIfEnabled() {
  return isAppEnabled().then((enabled) => {
    if (!enabled) return;
    hideButton();
  });
}
