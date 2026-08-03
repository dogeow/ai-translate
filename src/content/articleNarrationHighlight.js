/**
 * Word-level narration highlight without rewriting page content structure.
 *
 * Strategy (most reliable first for recognition-mode pages):
 * 1. Yellow class on matching `.ai-tr-word` spans already in the paragraph
 * 2. Fixed-position overlay marks with FULLY INLINE styles (no stylesheet dependency)
 * 3. Optional CSS Custom Highlight API
 */

export const ARTICLE_NARRATION_WORD_HIGHLIGHT_NAME =
  "ollama-article-narration-word";
export const ARTICLE_NARRATION_WORD_OVERLAY_ID =
  "ollama-article-narration-word-overlay";
export const ARTICLE_NARRATION_WORD_ACTIVE_CLASS =
  "ollama-article-narration-word-active";
export const ARTICLE_NARRATION_WORD_STYLE_ID =
  "ollama-article-narration-word-style";

const WORD_MARKER_SPAN_CLASS = "ai-tr-word";

const SKIP_TEXT_ANCESTOR_SELECTOR = [
  "script",
  "style",
  "noscript",
  "button",
  "input",
  "select",
  "textarea",
  "svg",
  "canvas",
  "#ollama-pt-bar",
  "#__ai_translate_word_card__",
  "#__ai_translate_tip__",
].join(",");

function normalizeWhitespaceChar(char) {
  return /\s/.test(char) ? " " : char;
}

export function normalizeHighlightWord(value) {
  return String(value || "")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

/**
 * Walk live text nodes and build a whitespace-collapsed string with a
 * per-character map back into the DOM.
 */
export function buildSpeechCharMap(element, mode = "original") {
  const ownerDocument = element?.ownerDocument || globalThis.document;
  const NodeFilterApi =
    globalThis.NodeFilter ||
    ownerDocument?.defaultView?.NodeFilter ||
    element?.ownerDocument?.defaultView?.NodeFilter;
  if (!element || !ownerDocument?.createTreeWalker || !NodeFilterApi) {
    return { text: "", map: [] };
  }

  const preferTranslation = mode === "translation";
  const walker = ownerDocument.createTreeWalker(
    element,
    NodeFilterApi.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilterApi.FILTER_REJECT;
        if (parent.closest(SKIP_TEXT_ANCESTOR_SELECTOR)) {
          return NodeFilterApi.FILTER_REJECT;
        }
        if (preferTranslation) {
          if (!parent.closest(".ollama-pt-trans")) {
            return NodeFilterApi.FILTER_REJECT;
          }
        } else if (parent.closest(".ollama-pt-trans")) {
          return NodeFilterApi.FILTER_REJECT;
        }
        return NodeFilterApi.FILTER_ACCEPT;
      },
    },
  );

  let text = "";
  const map = [];
  let pendingSpaceUnit = null;
  let started = false;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue || "";
    for (let offset = 0; offset < value.length; offset += 1) {
      const normalized = normalizeWhitespaceChar(value[offset]);
      if (normalized === " ") {
        if (!started) continue;
        if (!pendingSpaceUnit) {
          pendingSpaceUnit = { node, offset };
        }
        continue;
      }
      if (pendingSpaceUnit) {
        text += " ";
        map.push(pendingSpaceUnit);
        pendingSpaceUnit = null;
      }
      text += normalized;
      map.push({ node, offset });
      started = true;
    }
  }

  return { text, map };
}

export function resolveSpeechRange(charMap, start, length) {
  const map = charMap?.map;
  if (!Array.isArray(map) || map.length === 0) return null;
  const safeStart = Math.max(0, Math.min(map.length - 1, Number(start) || 0));
  const safeLength = Math.max(1, Number(length) || 1);
  const endExclusive = Math.min(map.length, safeStart + safeLength);
  const startUnit = map[safeStart];
  const endUnit = map[endExclusive - 1];
  if (!startUnit?.node || !endUnit?.node) return null;
  if (!startUnit.node.isConnected || !endUnit.node.isConnected) return null;

  try {
    const ownerDocument =
      startUnit.node.ownerDocument || globalThis.document;
    const range = ownerDocument.createRange();
    range.setStart(startUnit.node, startUnit.offset);
    range.setEnd(endUnit.node, endUnit.offset + 1);
    return range;
  } catch {
    return null;
  }
}

export function findWordRangeInElement(
  element,
  word,
  mode = "original",
  fromIndex = 0,
) {
  const needle = String(word || "").trim();
  if (!element || !needle) return null;
  const charMap = buildSpeechCharMap(element, mode);
  if (!charMap.text) return null;
  const startFrom = Math.max(0, Number(fromIndex) || 0);
  let index = charMap.text.indexOf(needle, startFrom);
  if (index < 0 && startFrom > 0) {
    index = charMap.text.indexOf(needle);
  }
  if (index < 0) {
    const stripped = normalizeHighlightWord(needle);
    if (stripped && stripped !== needle.toLowerCase()) {
      // Search case-insensitively in a simplified way
      const lower = charMap.text.toLowerCase();
      index = lower.indexOf(stripped, startFrom);
      if (index < 0 && startFrom > 0) index = lower.indexOf(stripped);
      if (index >= 0) {
        return resolveSpeechRange(charMap, index, stripped.length);
      }
    }
    return null;
  }
  return resolveSpeechRange(charMap, index, needle.length);
}

/**
 * Prefer existing recognition / studying word spans — visible yellow without overlay.
 * @returns {Element[]}
 */
export function findMatchingWordMarkers(element, word) {
  if (!element?.querySelectorAll) return [];
  const needle = normalizeHighlightWord(word);
  if (!needle) return [];
  const matches = [];
  for (const span of element.querySelectorAll(`.${WORD_MARKER_SPAN_CLASS}`)) {
    const dataWord = normalizeHighlightWord(span.getAttribute("data-word") || "");
    const textWord = normalizeHighlightWord(span.textContent || "");
    if (dataWord === needle || textWord === needle) {
      matches.push(span);
    }
  }
  return matches;
}

export function resolveSpokenWordRange({
  element,
  mode = "original",
  charIndex = 0,
  charLength = 0,
  textStart = 0,
  word = "",
  cachedCharMap = null,
} = {}) {
  if (!element?.isConnected) return null;

  const liveMap = buildSpeechCharMap(element, mode);
  const absoluteStart = (Number(textStart) || 0) + (Number(charIndex) || 0);
  const length = Math.max(1, Number(charLength) || 1);

  let range = resolveSpeechRange(liveMap, absoluteStart, length);
  if (range) return range;

  if (cachedCharMap?.map?.length) {
    range = resolveSpeechRange(cachedCharMap, absoluteStart, length);
    if (range) return range;
  }

  const spoken =
    String(word || "").trim() ||
    liveMap.text.slice(absoluteStart, absoluteStart + length).trim() ||
    String(cachedCharMap?.text || "")
      .slice(absoluteStart, absoluteStart + length)
      .trim();

  if (!spoken) return null;
  return findWordRangeInElement(element, spoken, mode, absoluteStart);
}

export function inferWordLength(text, start) {
  const source = String(text || "");
  const from = Math.max(0, Math.min(source.length, Number(start) || 0));
  if (from >= source.length) return 0;
  if (/\s/.test(source[from])) {
    let end = from + 1;
    while (end < source.length && /\s/.test(source[end])) end += 1;
    return end - from;
  }
  let end = from + 1;
  while (end < source.length && !/\s/.test(source[end])) end += 1;
  return end - from;
}

export function listSpeechWordSpans(text) {
  const source = String(text || "");
  const spans = [];
  const re = /\S+/g;
  let match = re.exec(source);
  while (match) {
    spans.push({
      start: match.index,
      length: match[0].length,
      word: match[0],
    });
    match = re.exec(source);
  }
  return spans;
}

export function isWordBoundaryEvent(event) {
  if (!event || typeof event !== "object") return false;
  const name = String(event.name || "").toLowerCase();
  if (name === "sentence") return false;
  if (name === "word" || name === "") {
    return Number.isFinite(Number(event.charIndex));
  }
  return name !== "mark" && Number.isFinite(Number(event.charIndex));
}

function ensureWordHighlightStyles(doc) {
  if (!doc?.getElementById) return;
  if (doc.getElementById(ARTICLE_NARRATION_WORD_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = ARTICLE_NARRATION_WORD_STYLE_ID;
  style.textContent = `
    .${ARTICLE_NARRATION_WORD_ACTIVE_CLASS}{
      background: #fde047 !important;
      background-color: #fde047 !important;
      color: #111827 !important;
      border: 2px solid #b45309 !important;
      border-radius: 4px !important;
      box-shadow: 0 0 0 1px #fbbf24, 0 1px 3px rgba(0,0,0,.18) !important;
      outline: none !important;
    }
    ::highlight(${ARTICLE_NARRATION_WORD_HIGHLIGHT_NAME}){
      background-color:#fde047;
      color:#111827;
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
}

/**
 * @param {{ document?: Document, CSS?: typeof globalThis.CSS }} [env]
 */
export function createNarrationWordHighlighter(env = {}) {
  const doc = env.document || globalThis.document;
  const cssApi = env.CSS || globalThis.CSS;
  const supportsCustomHighlight =
    typeof cssApi?.highlights?.set === "function" &&
    typeof globalThis.Highlight === "function";

  let activeHighlight = null;
  let overlayRoot = null;
  let scrollListener = null;
  let lastRange = null;
  let activeMarkers = [];

  ensureWordHighlightStyles(doc);

  function clearMarkers() {
    for (const el of activeMarkers) {
      try {
        el.classList?.remove?.(ARTICLE_NARRATION_WORD_ACTIVE_CLASS);
      } catch {
        /* ignore */
      }
    }
    activeMarkers = [];
  }

  function paintMarkers(element, word) {
    clearMarkers();
    const matches = findMatchingWordMarkers(element, word);
    for (const span of matches) {
      span.classList.add(ARTICLE_NARRATION_WORD_ACTIVE_CLASS);
      activeMarkers.push(span);
    }
    return matches.length > 0;
  }

  function ensureOverlayRoot() {
    const mount = doc.documentElement || doc.body;
    if (!mount) return null;
    if (overlayRoot?.isConnected) return overlayRoot;
    overlayRoot = doc.getElementById(ARTICLE_NARRATION_WORD_OVERLAY_ID);
    if (!overlayRoot) {
      overlayRoot = doc.createElement("div");
      overlayRoot.id = ARTICLE_NARRATION_WORD_OVERLAY_ID;
      overlayRoot.setAttribute("aria-hidden", "true");
      // Inline critical host styles — do not depend on extension stylesheet.
      Object.assign(overlayRoot.style, {
        all: "initial",
        position: "fixed",
        left: "0",
        top: "0",
        width: "0",
        height: "0",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: "2147483645",
      });
      mount.appendChild(overlayRoot);
    }
    if (!scrollListener && globalThis.addEventListener) {
      scrollListener = () => {
        if (lastRange) paintOverlay(lastRange);
      };
      globalThis.addEventListener("scroll", scrollListener, true);
      globalThis.addEventListener("resize", scrollListener);
    }
    return overlayRoot;
  }

  function clearOverlay() {
    if (overlayRoot) overlayRoot.replaceChildren();
  }

  function paintOverlay(range) {
    const root = ensureOverlayRoot();
    if (!root || !range) return false;
    root.replaceChildren();
    let rects;
    try {
      rects = range.getClientRects?.() || [];
    } catch {
      return false;
    }
    let painted = 0;
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const mark = doc.createElement("div");
      // Fully inline — never rely on page/extension CSS for visibility.
      Object.assign(mark.style, {
        position: "fixed",
        left: `${Math.max(0, rect.left - 1)}px`,
        top: `${Math.max(0, rect.top - 1)}px`,
        width: `${Math.max(rect.width + 2, 4)}px`,
        height: `${Math.max(rect.height + 2, 4)}px`,
        boxSizing: "border-box",
        borderRadius: "4px",
        background: "rgba(253, 224, 71, 0.55)",
        border: "2px solid #b45309",
        boxShadow: "0 0 0 1px #fbbf24, 0 1px 3px rgba(0,0,0,0.2)",
        pointerEvents: "none",
        zIndex: "2147483645",
      });
      root.appendChild(mark);
      painted += 1;
    }
    return painted > 0;
  }

  function clear() {
    lastRange = null;
    clearMarkers();
    if (supportsCustomHighlight) {
      try {
        cssApi.highlights.delete(ARTICLE_NARRATION_WORD_HIGHLIGHT_NAME);
      } catch {
        /* ignore */
      }
      activeHighlight = null;
    }
    clearOverlay();
  }

  /**
   * @param {Range | null} range
   * @param {{ element?: Element, word?: string }} [context]
   */
  function highlightRange(range, context = {}) {
    const { element = null, word = "" } = context;
    if (!range && !word) {
      clear();
      return false;
    }

    let ok = false;
    if (element && word) {
      ok = paintMarkers(element, word) || ok;
    }

    if (range) {
      lastRange = range;
      ok = paintOverlay(range) || ok;
      if (supportsCustomHighlight) {
        try {
          activeHighlight = new globalThis.Highlight(range);
          cssApi.highlights.set(
            ARTICLE_NARRATION_WORD_HIGHLIGHT_NAME,
            activeHighlight,
          );
        } catch {
          /* overlay / markers already attempted */
        }
      }
    } else {
      lastRange = null;
      clearOverlay();
    }

    return ok;
  }

  function destroy() {
    clear();
    if (scrollListener && globalThis.removeEventListener) {
      globalThis.removeEventListener("scroll", scrollListener, true);
      globalThis.removeEventListener("resize", scrollListener);
      scrollListener = null;
    }
    overlayRoot?.remove?.();
    overlayRoot = null;
    doc.getElementById(ARTICLE_NARRATION_WORD_STYLE_ID)?.remove?.();
  }

  return {
    clear,
    destroy,
    highlightRange,
    supportsCustomHighlight,
  };
}
