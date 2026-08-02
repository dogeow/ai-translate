/**
 * Word-level narration highlight without rewriting page DOM.
 * Uses a fixed-position overlay (reliable in content scripts) plus optional
 * CSS Custom Highlight when the page stylesheet cooperates.
 */

export const ARTICLE_NARRATION_WORD_HIGHLIGHT_NAME =
  "ollama-article-narration-word";
export const ARTICLE_NARRATION_WORD_OVERLAY_ID =
  "ollama-article-narration-word-overlay";

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

/**
 * Walk live text nodes and build a whitespace-collapsed string with a
 * per-character map back into the DOM.
 *
 * @param {Element} element
 * @param {"original" | "translation"} mode
 * @returns {{ text: string, map: Array<{ node: Text, offset: number }> }}
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

/**
 * Resolve a spoken character span to a live DOM Range.
 * @param {{ map: Array<{ node: Text, offset: number }> }} charMap
 * @param {number} start
 * @param {number} length
 * @returns {Range | null}
 */
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

/**
 * Find a word occurrence in the live element after `fromIndex` in the
 * collapsed speech string (handles recognition re-wrapping text nodes).
 * @param {Element} element
 * @param {string} word
 * @param {"original" | "translation"} mode
 * @param {number} [fromIndex=0]
 * @returns {Range | null}
 */
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
    // Strip trailing punctuation for engines that include "region," as a word.
    const stripped = needle.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (stripped && stripped !== needle) {
      index = charMap.text.indexOf(stripped, startFrom);
      if (index < 0 && startFrom > 0) index = charMap.text.indexOf(stripped);
      if (index >= 0) {
        return resolveSpeechRange(charMap, index, stripped.length);
      }
    }
    return null;
  }
  return resolveSpeechRange(charMap, index, needle.length);
}

/**
 * Resolve the best Range for a spoken word span.
 * Rebuilds the char map every call so recognition re-wraps stay valid.
 *
 * @param {object} opts
 * @param {Element} opts.element
 * @param {"original" | "translation"} [opts.mode]
 * @param {number} [opts.charIndex] index in the utterance chunk
 * @param {number} [opts.charLength]
 * @param {number} [opts.textStart] chunk start in the full section speech text
 * @param {string} [opts.word]
 * @param {{ text: string, map: Array } | null} [opts.cachedCharMap] optional hint
 * @returns {Range | null}
 */
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

  // Cached map from queue build (only if still connected).
  if (cachedCharMap?.map?.length) {
    range = resolveSpeechRange(cachedCharMap, absoluteStart, length);
    if (range) return range;
  }

  const spoken =
    String(word || "").trim() ||
    liveMap.text.slice(absoluteStart, absoluteStart + length).trim() ||
    String(cachedCharMap?.text || "").slice(absoluteStart, absoluteStart + length).trim();

  if (!spoken) return null;
  return findWordRangeInElement(element, spoken, mode, absoluteStart);
}

/**
 * Infer word length when the engine omits charLength.
 * @param {string} text
 * @param {number} start
 */
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

/**
 * Non-whitespace spans in spoken text (for boundary fallbacks).
 * @param {string} text
 * @returns {Array<{ start: number, length: number, word: string }>}
 */
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

/**
 * Whether a SpeechSynthesis boundary event should update the word highlight.
 * @param {SpeechSynthesisEvent | { name?: string, charIndex?: number }} event
 */
export function isWordBoundaryEvent(event) {
  if (!event || typeof event !== "object") return false;
  const name = String(event.name || "").toLowerCase();
  if (name === "sentence") return false;
  if (name === "word" || name === "") {
    return Number.isFinite(Number(event.charIndex));
  }
  return name !== "mark" && Number.isFinite(Number(event.charIndex));
}

/**
 * Create a highlighter that never rewrites page content.
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

  function ensureOverlayRoot() {
    const mount = doc.documentElement || doc.body;
    if (!mount) return null;
    if (overlayRoot?.isConnected) return overlayRoot;
    overlayRoot = doc.getElementById(ARTICLE_NARRATION_WORD_OVERLAY_ID);
    if (!overlayRoot) {
      overlayRoot = doc.createElement("div");
      overlayRoot.id = ARTICLE_NARRATION_WORD_OVERLAY_ID;
      overlayRoot.setAttribute("aria-hidden", "true");
      mount.appendChild(overlayRoot);
    }
    if (!scrollListener && globalThis.addEventListener) {
      scrollListener = () => {
        // Marks use fixed coords; clear stale boxes on scroll until next word.
        if (overlayRoot) overlayRoot.replaceChildren();
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
    if (!root) return false;
    root.replaceChildren();
    // fixed + viewport rects (no scroll offset) — survives body transforms.
    const rects = range.getClientRects?.() || [];
    let painted = 0;
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const mark = doc.createElement("div");
      mark.className = "ollama-article-narration-word-mark";
      mark.style.position = "fixed";
      mark.style.left = `${rect.left}px`;
      mark.style.top = `${rect.top}px`;
      mark.style.width = `${Math.max(rect.width, 2)}px`;
      mark.style.height = `${Math.max(rect.height, 2)}px`;
      root.appendChild(mark);
      painted += 1;
    }
    return painted > 0;
  }

  function clear() {
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

  function highlightRange(range) {
    if (!range) {
      clear();
      return false;
    }
    const painted = paintOverlay(range);
    if (supportsCustomHighlight) {
      try {
        activeHighlight = new globalThis.Highlight(range);
        cssApi.highlights.set(
          ARTICLE_NARRATION_WORD_HIGHLIGHT_NAME,
          activeHighlight,
        );
      } catch {
        /* overlay already attempted */
      }
    }
    return painted;
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
  }

  return {
    clear,
    destroy,
    highlightRange,
    supportsCustomHighlight,
  };
}
