/** 翻译结果小窗：React 挂载、定位、关闭与交互桥接 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { TIP_ID, isAppEnabled } from "./constants.js";
import { injectStyles } from "./styles.js";
import { getSelectionRect, getElementRect } from "./selection.js";
import { TipView } from "./tip/TipView.jsx";

let tipElement = null;
let tipRoot = null;
let detachDocumentListeners = null;
let renderToken = 0;
let onTipHide = null;

function setSyncStorage(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function ensureTipRoot() {
  if (tipElement && tipRoot) return;
  tipElement = document.createElement("div");
  tipElement.id = TIP_ID;
  tipElement.style.visibility = "hidden";
  document.body.appendChild(tipElement);
  tipRoot = createRoot(tipElement);
}

function cleanupDocumentListeners() {
  if (!detachDocumentListeners) return;
  detachDocumentListeners();
  detachDocumentListeners = null;
}

function bindDocumentListeners() {
  cleanupDocumentListeners();

  function onEscape(event) {
    if (event.key === "Escape") {
      hideTip();
    }
  }

  function onClickOutside(event) {
    if (tipElement && tipElement.contains(event.target)) return;
    hideTip();
  }

  document.addEventListener("keydown", onEscape);
  document.addEventListener("mousedown", onClickOutside);
  detachDocumentListeners = () => {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("mousedown", onClickOutside);
  };
}

function getAnchorRect(lastTipRect) {
  const rect = lastTipRect || getSelectionRect();
  if (rect && (rect.left != null || rect.bottom != null)) {
    return rect;
  }
  return { bottom: 100, left: 50, top: 92, right: 50 };
}

function resolveTipWidthMode(result) {
  const original = String(result?.original || "");
  const translation = String(result?.translation || "");
  const thinking = String(result?.thinking || "");
  const samples = [original, translation, thinking]
    .flatMap((text) => text.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  const longestLineLength = samples.reduce(
    (maxLen, line) => Math.max(maxLen, line.length),
    0,
  );
  const combinedLength = `${original}\n${translation}`.replace(/\s+/g, " ").trim()
    .length;

  if (longestLineLength >= 120 || combinedLength >= 220) return "wide";
  if (longestLineLength >= 70 || combinedLength >= 120) return "medium";
  return "compact";
}

function applyTipWidthMode(result) {
  if (!tipElement) return;
  tipElement.dataset.widthMode = resolveTipWidthMode(result);
}

function positionTip(anchorRect) {
  if (!tipElement) return;
  const rect = getElementRect(tipElement);
  const tipWidth = rect.right - rect.left;
  const tipHeight = rect.bottom - rect.top;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const safeMargin = 8;
  const pad = 8;
  const leftAnchor = anchorRect.left ?? safeMargin;
  const topAnchor = anchorRect.top ?? (anchorRect.bottom ?? 100) - 8;
  const bottomAnchor = anchorRect.bottom ?? topAnchor + 8;

  let left = Math.min(leftAnchor, viewWidth - tipWidth - safeMargin);
  left = Math.max(safeMargin, left);

  let top;
  if (bottomAnchor + pad + tipHeight > viewHeight - safeMargin) {
    top = topAnchor - pad - tipHeight;
  } else {
    top = bottomAnchor + pad;
  }
  top = Math.max(safeMargin, top);

  tipElement.style.top = `${top}px`;
  tipElement.style.left = `${left}px`;
  tipElement.style.visibility = "visible";
}

async function handleTranslateWithModel(result, modelName) {
  await setSyncStorage({ ollamaModel: modelName });

  if (!result.original) return;

  await sendRuntimeMessage({
    action: "translate",
    text: result.original,
    fromTip: true,
  }).catch(() => {});
}

function getWordLearningStatus(word) {
  return sendRuntimeMessage({
    action: "getWordLearningStatus",
    word,
  });
}

function setWordLearningStatus(word, status) {
  return sendRuntimeMessage({
    action: "setWordLearningStatus",
    word,
    status,
  });
}

export function hideTip() {
  cleanupDocumentListeners();
  renderToken += 1;
  if (tipRoot) {
    tipRoot.unmount();
    tipRoot = null;
  }
  if (tipElement) {
    tipElement.remove();
    tipElement = null;
  }
  onTipHide?.();
}

export function setTipHideHandler(handler) {
  onTipHide = typeof handler === "function" ? handler : null;
}

/**
 * @param {object} result - 翻译结果或需选模型状态
 * @param {{ top: number, bottom: number, left: number, right?: number } | null} lastTipRect - 上次 tip 锚点矩形
 */
export function showTip(result, lastTipRect) {
  injectStyles();
  const anchorRect = getAnchorRect(lastTipRect);
  ensureTipRoot();
  applyTipWidthMode(result);
  bindDocumentListeners();

  const nextRenderToken = ++renderToken;
  tipElement.style.visibility = "hidden";
  tipRoot.render(
    createElement(TipView, {
      result,
      onClose: hideTip,
      onTranslateWithModel: (modelName) =>
        handleTranslateWithModel(result, modelName),
      onGetWordLearningStatus: getWordLearningStatus,
      onSetWordLearningStatus: setWordLearningStatus,
    }),
  );

  window.requestAnimationFrame(() => {
    if (!tipElement || nextRenderToken !== renderToken) return;
    positionTip(anchorRect);
  });
}
