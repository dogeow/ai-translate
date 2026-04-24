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

function previewText(text, maxLength = 48) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...`
    : value;
}

function debugRect(rect) {
  if (!rect) return null;
  return {
    left: Math.round(rect.left * 10) / 10,
    top: Math.round(rect.top * 10) / 10,
    right: Math.round(rect.right * 10) / 10,
    bottom: Math.round(rect.bottom * 10) / 10,
    width: Math.round(rect.width * 10) / 10,
    height: Math.round(rect.height * 10) / 10,
  };
}

function debugElement(element) {
  if (!element) return null;
  return {
    tag: element.tagName || "",
    id: element.id || "",
    className:
      typeof element.className === "string"
        ? element.className.slice(0, 80)
        : "",
    text: previewText(element.textContent || ""),
  };
}

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

function rectContainsPoint(rect, clientX, clientY, padding = 1) {
  if (!rect) return false;
  return (
    clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding
  );
}

function rangeContainsPoint(range, clientX, clientY, padding = 1) {
  if (!range) return false;
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  if (rects.length === 0) {
    return rectContainsPoint(
      range.getBoundingClientRect(),
      clientX,
      clientY,
      padding,
    );
  }
  return rects.some((rect) =>
    rectContainsPoint(rect, clientX, clientY, padding)
  );
}

function textNodeContainsPoint(node, clientX, clientY, padding = 0) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;
  const text = String(node.textContent || "");
  if (!text.trim()) return false;

  const textRange = document.createRange();
  textRange.selectNodeContents(node);
  return rangeContainsPoint(textRange, clientX, clientY, padding);
}

function getTextNodeRect(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = String(node.textContent || "");
  if (!text.trim()) return null;
  const textRange = document.createRange();
  textRange.selectNodeContents(node);
  return textRange.getBoundingClientRect();
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
    if (node.nodeType !== Node.TEXT_NODE) return null;
    if (!textNodeContainsPoint(node, clientX, clientY)) {
      return null;
    }
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
  if (!textNodeContainsPoint(node, clientX, clientY)) {
    return null;
  }
  const info = getWordInfoAtOffset(node.textContent || "", range.startOffset);
  if (!info.word) return null;

  const wordRange = document.createRange();
  wordRange.setStart(node, info.start);
  wordRange.setEnd(node, info.end);
  if (!rangeContainsPoint(wordRange, clientX, clientY)) {
    return null;
  }
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

export function inspectHoverTranslatePoint(clientX, clientY, scope = "word") {
  const hitElement = document.elementFromPoint(clientX, clientY);
  const result = {
    clientX,
    clientY,
    scope,
    hitElement: debugElement(hitElement),
    decision: "unknown",
  };

  const range = getPointRange(clientX, clientY);
  if (!range) {
    result.decision = "no-range";
    return result;
  }

  const node = range.startContainer;
  const offset = range.startOffset;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  result.rangeOffset = offset;
  result.nodeType = node.nodeType;
  result.nodeText =
    node.nodeType === Node.TEXT_NODE
      ? previewText(node.textContent || "")
      : node.nodeName || "";
  result.anchorElement = debugElement(element);

  if (!element) {
    result.decision = "no-element";
    return result;
  }

  if (isEditableElement(element)) {
    result.decision = "editable";
    return result;
  }

  if (isInteractiveElement(element)) {
    result.decision = "interactive";
    return result;
  }

  if (scope === "paragraph") {
    if (node.nodeType !== Node.TEXT_NODE) {
      result.decision = "paragraph-not-text-node";
      return result;
    }
    result.textNodeRect = debugRect(getTextNodeRect(node));
    result.textNodeHit = textNodeContainsPoint(node, clientX, clientY);
    if (!result.textNodeHit) {
      result.decision = "miss-paragraph-text";
      return result;
    }
    const container = getParagraphContainer(element);
    const text = getElementFullText(container);
    result.container = debugElement(container);
    result.containerRect = debugRect(container?.getBoundingClientRect?.());
    result.text = previewText(text);
    result.textLength = text.length;
    result.decision = text ? "accept-paragraph" : "empty-paragraph";
    return result;
  }

  if (node.nodeType !== Node.TEXT_NODE) {
    result.decision = "not-text-node";
    return result;
  }

  result.textNodeRect = debugRect(getTextNodeRect(node));
  result.textNodeHit = textNodeContainsPoint(node, clientX, clientY);
  if (!result.textNodeHit) {
    result.decision = "miss-text-node";
    return result;
  }

  const info = getWordInfoAtOffset(node.textContent || "", offset);
  result.word = info.word;
  result.wordStart = info.start;
  result.wordEnd = info.end;
  if (!info.word) {
    result.decision = "empty-word";
    return result;
  }

  const wordRange = document.createRange();
  wordRange.setStart(node, info.start);
  wordRange.setEnd(node, info.end);
  result.wordRect = debugRect(wordRange.getBoundingClientRect());
  result.wordHit = rangeContainsPoint(wordRange, clientX, clientY);
  result.key = `word:${getNodeId(node)}:${info.start}:${info.end}`;
  result.decision = result.wordHit ? "accept-word" : "miss-word-range";
  return result;
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
