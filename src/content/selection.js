/** 选区与光标处文本的工具函数 */

const BLOCK_CONTAINER_SELECTOR =
  "article, aside, blockquote, dd, div, dl, dt, figcaption, footer, h1, h2, h3, h4, h5, h6, header, li, main, nav, p, pre, section, td, th";
const BLOCK_DISPLAY_VALUES = new Set([
  "block",
  "list-item",
  "table-cell",
  "flex",
  "grid",
]);
const nodeIds = new WeakMap();
let nextNodeId = 1;

function getPointRange(clientX, clientY) {
  if (typeof document.caretRangeFromPoint === "function") {
    try {
      return document.caretRangeFromPoint(clientX, clientY);
    } catch (_) {}
  }
  if (typeof document.caretPositionFromPoint === "function") {
    try {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (!position) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    } catch (_) {}
  }
  return null;
}

function toRect(rect) {
  if (!rect) return null;
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

function isEditableElement(element) {
  return !!(
    element &&
    element.closest &&
    element.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  );
}

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "summary",
  "label",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="treeitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  "[data-no-translate]",
].join(", ");

export function isInteractiveElement(element) {
  return !!(
    element &&
    element.closest &&
    element.closest(INTERACTIVE_SELECTOR)
  );
}

function getNodeId(node) {
  if (!node) return 0;
  let id = nodeIds.get(node);
  if (!id) {
    id = nextNodeId++;
    nodeIds.set(node, id);
  }
  return id;
}

function getWordInfoAtOffset(text, offset) {
  if (!text || offset < 0 || offset > text.length) {
    return { word: "", start: 0, end: 0 };
  }
  let start = offset;
  let end = offset;

  while (start > 0 && /\S/.test(text[start - 1])) start -= 1;
  while (end < text.length && /\S/.test(text[end])) end += 1;

  return {
    word: text.slice(start, end).trim().slice(0, 200),
    start,
    end,
  };
}

function getParagraphContainer(element) {
  if (!element) return null;
  if (element.closest) {
    const block = element.closest(BLOCK_CONTAINER_SELECTOR);
    if (block && block !== document.body) return block;
  }
  let current = element;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      const display = window.getComputedStyle(current).display;
      if (BLOCK_DISPLAY_VALUES.has(display)) {
        return current;
      }
    }
    current = current.parentElement;
  }
  return element;
}

/**
 * 从选区或悬停位置得到当前容器元素和文本（供 getTextToTranslate 使用）
 * @param {number} lastMouseX - 上次鼠标 clientX
 * @param {number} lastMouseY - 上次鼠标 clientY
 */
export function getCurrentElementAndText(lastMouseX, lastMouseY) {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const element =
      ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
    const text = sel.toString().trim();
    if (element && text) return { element, text };
  }
  try {
    const range = getPointRange(lastMouseX, lastMouseY);
    if (!range) return { element: null, text: "" };
    const node = range.startContainer;
    const offset = range.startOffset;
    const element =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (isInteractiveElement(element)) {
      return { element: null, text: "" };
    }
    let text = "";
    if (node.nodeType === Node.TEXT_NODE) {
      text = getWordAtOffset(node.textContent || "", offset);
    }
    if (element)
      return {
        element,
        text: text || element.textContent.trim().slice(0, 200),
      };
  } catch (_) {}
  return { element: null, text: "" };
}

export function getElementFullText(el) {
  if (!el || !el.innerText) return "";
  return el.innerText.trim().slice(0, 15000);
}

export function getWordAtOffset(text, offset) {
  return getWordInfoAtOffset(text, offset).word;
}

export function getWordUnderCursor(clientX, clientY) {
  try {
    const range = getPointRange(clientX, clientY);
    if (!range) return "";
    const node = range.startContainer;
    const offset = range.startOffset;
    if (node.nodeType === Node.TEXT_NODE) {
      return getWordAtOffset(node.textContent || "", offset);
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length === 0) {
      return "";
    }
    return "";
  } catch (_) {
    return "";
  }
}

export function getHoverTranslateTarget(clientX, clientY, scope = "word") {
  const range = getPointRange(clientX, clientY);
  if (!range) return null;

  const node = range.startContainer;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element || isEditableElement(element) || isInteractiveElement(element)) {
    return null;
  }

  if (scope === "paragraph") {
    const container = getParagraphContainer(element);
    const text = getElementFullText(container);
    if (!text) return null;
    return {
      element: container,
      text,
      rect: toRect(container.getBoundingClientRect()),
      key: `paragraph:${getNodeId(container)}`,
    };
  }

  if (node.nodeType !== Node.TEXT_NODE) return null;
  const info = getWordInfoAtOffset(node.textContent || "", range.startOffset);
  if (!info.word) return null;

  const wordRange = document.createRange();
  wordRange.setStart(node, info.start);
  wordRange.setEnd(node, info.end);
  const wordRect = wordRange.getBoundingClientRect();
  const rect =
    wordRect.width > 0 || wordRect.height > 0
      ? toRect(wordRect)
      : toRect(element.getBoundingClientRect());

  return {
    element,
    text: info.word,
    rect,
    key: `word:${getNodeId(node)}:${info.start}:${info.end}`,
  };
}

export function getSelectionText() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return "";
  const text = sel.toString().trim();
  return text.length > 0 ? text : "";
}

export function getSelectionRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

export function getElementRect(el) {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
  };
}
