import {
  buildSpeechCharMap,
  createNarrationWordHighlighter,
  inferWordLength,
  isWordBoundaryEvent,
  listSpeechWordSpans,
  resolveSpokenWordRange,
} from "./articleNarrationHighlight.js";

const ARTICLE_CONTAINER_SELECTOR = "article, main, [role='main']";
const ARTICLE_SECTION_SELECTOR = "h1, h2, h3, p, blockquote, li, figcaption";
const SKIP_ANCESTOR_SELECTOR = [
  "nav",
  "aside",
  "footer",
  "form",
  "dialog",
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "select",
  "option",
  "code",
  "pre",
  "svg",
  "canvas",
  "[aria-hidden='true']",
  "[data-no-translate]",
  "#ollama-pt-bar",
  "#__ai_translate_word_card__",
  "#__ai_translate_tip__",
].join(",");
const REMOVE_FROM_TEXT_SELECTOR = [
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
].join(",");
const SIGNIFICANT_TEXT_RE = /[\p{L}\p{N}\u3400-\u9fff]/u;
const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
const DEFAULT_MAX_CHARS = 240;
const NOVELTY_VOICE_RE = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox)$/i;
const NATURAL_VOICE_PREFERENCES = Object.freeze({
  "en-US": [
    /Google US English/i,
    /Microsoft.*Natural/i,
    /^Samantha$/i,
    /^Ava( \(|$)/i,
    /^Allison( \(|$)/i,
    /^Susan( \(|$)/i,
    /^Tom( \(|$)/i,
  ],
  "en-GB": [
    /Google UK English/i,
    /Microsoft.*Natural/i,
    /^Daniel$/i,
    /^Serena( \(|$)/i,
    /^Kate( \(|$)/i,
    /^Oliver( \(|$)/i,
  ],
  zh: [
    /Google.*(中文|Chinese)/i,
    /Microsoft.*Natural/i,
    /^(婷婷|Tingting)$/i,
    /^(美嘉|Meijia)$/i,
  ],
});

export const ARTICLE_NARRATION_MODE = Object.freeze({
  ORIGINAL: "original",
  TRANSLATION: "translation",
  BILINGUAL: "bilingual",
});

export const ARTICLE_NARRATION_ACCENT = Object.freeze({
  US: "us",
  UK: "uk",
});

export const ARTICLE_NARRATION_STATUS = Object.freeze({
  IDLE: "idle",
  PLAYING: "playing",
  PAUSED: "paused",
  ERROR: "error",
});

export const ARTICLE_NARRATION_MODE_KEY = "articleNarrationMode";
export const ARTICLE_NARRATION_RATE_KEY = "articleNarrationRate";
export const ARTICLE_NARRATION_ACCENT_KEY = "articleNarrationAccent";
export const ARTICLE_NARRATION_SETTING_KEYS = Object.freeze([
  ARTICLE_NARRATION_MODE_KEY,
  ARTICLE_NARRATION_RATE_KEY,
  ARTICLE_NARRATION_ACCENT_KEY,
]);

export const ARTICLE_NARRATION_RATES = Object.freeze([0.75, 1, 1.25, 1.5]);

export function normalizeArticleNarrationMode(value) {
  return Object.values(ARTICLE_NARRATION_MODE).includes(value)
    ? value
    : ARTICLE_NARRATION_MODE.ORIGINAL;
}

export function normalizeArticleNarrationAccent(value) {
  return Object.values(ARTICLE_NARRATION_ACCENT).includes(value)
    ? value
    : ARTICLE_NARRATION_ACCENT.US;
}

export function normalizeArticleNarrationRate(value) {
  const number = Number(value);
  return ARTICLE_NARRATION_RATES.includes(number) ? number : 1;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isElementVisible(element) {
  if (!element || !(element instanceof HTMLElement)) return false;
  let current = element;
  while (current && current instanceof HTMLElement) {
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      (style.opacity !== "" && Number(style.opacity) <= 0.01) ||
      current.hidden
    ) {
      return false;
    }
    current = current.parentElement;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function extractElementText(element, mode) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll(REMOVE_FROM_TEXT_SELECTOR).forEach((node) => node.remove());

  if (mode === ARTICLE_NARRATION_MODE.TRANSLATION) {
    if (!clone.querySelector(".ollama-pt-trans")) return "";
    clone.querySelectorAll(".ollama-pt-orig").forEach((node) => node.remove());
  } else {
    clone.querySelectorAll(".ollama-pt-trans").forEach((node) => node.remove());
  }

  return normalizeText(clone.textContent);
}

function findArticleContainer(root) {
  if (!root?.querySelector) return root;
  return root.querySelector(ARTICLE_CONTAINER_SELECTOR) || root;
}

function shouldSkipSection(element, { requireVisible, isUiElement }) {
  if (!element || element.closest(SKIP_ANCESTOR_SELECTOR)) return true;
  if (isUiElement?.(element)) return true;
  if (requireVisible && !isElementVisible(element)) return true;
  if (
    element.matches("li, blockquote") &&
    element.querySelector(ARTICLE_SECTION_SELECTOR)
  ) {
    return true;
  }
  return false;
}

function resolveStartSectionIndex(sections, startElement) {
  if (startElement) {
    const directIndex = sections.findIndex(
      (section) =>
        section.element === startElement ||
        section.element.contains(startElement) ||
        startElement.contains?.(section.element),
    );
    if (directIndex >= 0) return directIndex;
  }

  const viewportIndex = sections.findIndex((section) => {
    const rect = section.element.getBoundingClientRect?.();
    return rect && rect.bottom > 0 && rect.top < window.innerHeight;
  });
  return Math.max(0, viewportIndex);
}

const NARRATION_SECTION_SELECTOR = ARTICLE_SECTION_SELECTOR;

/**
 * Resolve where narration should start.
 * Priority: explicit element → selection → content click anchor → viewport → document start.
 *
 * @param {object} opts
 * @param {Element | null} [opts.explicit]
 * @param {Element | null} [opts.contentClickTarget]
 * @param {Document} [opts.document]
 * @param {(el: Element) => boolean} [opts.isUiElement]
 * @returns {{ element: Element | null, source: string }}
 */
export function resolveNarrationStartAnchor({
  explicit = null,
  contentClickTarget = null,
  document: doc = globalThis.document,
  isUiElement = null,
} = {}) {
  function usable(node) {
    let el = node;
    if (el && el.nodeType === 3) el = el.parentElement;
    if (!el || el.nodeType !== 1 || typeof el.closest !== "function") {
      return null;
    }
    if (isUiElement?.(el)) return null;
    try {
      if (
        el.closest?.(
          "#ollama-pt-bar, #ai-translate-hover-btn, #ai-translate-tip, #ai-translate-shortcut-hint, #ai-translate-hover-target, #__ai_translate_word_card__",
        )
      ) {
        return null;
      }
    } catch {
      /* ignore selector issues in test envs */
    }
    try {
      const section = el.closest(NARRATION_SECTION_SELECTOR);
      if (section && !isUiElement?.(section)) return section;
    } catch {
      /* ignore */
    }
    if (
      typeof el.matches === "function" &&
      el.matches(NARRATION_SECTION_SELECTOR) &&
      !isUiElement?.(el)
    ) {
      return el;
    }
    return null;
  }

  const fromExplicit = usable(explicit);
  if (fromExplicit) return { element: fromExplicit, source: "explicit" };

  try {
    const selection = doc?.getSelection?.();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const node =
        selection.anchorNode?.nodeType === 3
          ? selection.anchorNode.parentElement
          : selection.anchorNode;
      const fromSelection = usable(node);
      if (fromSelection) return { element: fromSelection, source: "selection" };
    }
  } catch {
    /* ignore */
  }

  const fromClick = usable(contentClickTarget);
  if (fromClick) return { element: fromClick, source: "click" };

  // Viewport: prefer the section closest to the vertical center of the screen.
  try {
    const midY = (globalThis.innerHeight || 0) / 2;
    let best = null;
    let bestDist = Infinity;
    const candidates = doc?.querySelectorAll?.(NARRATION_SECTION_SELECTOR) || [];
    for (const el of candidates) {
      if (!usable(el)) continue;
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.bottom <= 0 || rect.top >= (globalThis.innerHeight || 0)) {
        continue;
      }
      const center = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(center - midY);
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }
    if (best) return { element: best, source: "viewport" };
  } catch {
    /* ignore */
  }

  return { element: null, source: "document-start" };
}

function flashNarrationStart(element) {
  if (!element?.classList) return;
  element.classList.add("ollama-article-narration-start-flash");
  globalThis.setTimeout?.(() => {
    element.classList?.remove?.("ollama-article-narration-start-flash");
  }, 700);
}

export function collectArticleNarrationSections(
  root,
  {
    mode = ARTICLE_NARRATION_MODE.ORIGINAL,
    startElement = null,
    requireVisible = true,
    isUiElement = null,
  } = {},
) {
  const normalizedMode = normalizeArticleNarrationMode(mode);
  const container = findArticleContainer(root);
  if (!container?.querySelectorAll) return [];

  const sections = [];
  for (const element of container.querySelectorAll(ARTICLE_SECTION_SELECTOR)) {
    if (shouldSkipSection(element, { requireVisible, isUiElement })) continue;

    const originalText = extractElementText(
      element,
      ARTICLE_NARRATION_MODE.ORIGINAL,
    );
    const translatedText = extractElementText(
      element,
      ARTICLE_NARRATION_MODE.TRANSLATION,
    );
    const texts =
      normalizedMode === ARTICLE_NARRATION_MODE.BILINGUAL
        ? [originalText, translatedText]
        : [
            normalizedMode === ARTICLE_NARRATION_MODE.TRANSLATION
              ? translatedText
              : originalText,
          ];
    const validTexts = texts.filter(
      (text) => text && SIGNIFICANT_TEXT_RE.test(text),
    );
    if (validTexts.length === 0) continue;
    sections.push({ element, texts: validTexts });
  }

  const startIndex = resolveStartSectionIndex(sections, startElement);
  return sections.slice(startIndex);
}

function findSplitIndex(text, maxChars) {
  const head = text.slice(0, maxChars + 1);
  const sentenceMatches = [...head.matchAll(/[.!?。！？;；:]\s*/g)];
  const sentenceIndex = sentenceMatches.at(-1)?.index;
  if (Number.isInteger(sentenceIndex) && sentenceIndex >= maxChars * 0.45) {
    const match = sentenceMatches.at(-1)[0];
    return sentenceIndex + match.length;
  }
  const spaceIndex = head.lastIndexOf(" ");
  if (spaceIndex >= maxChars * 0.45) return spaceIndex + 1;
  return maxChars;
}

/**
 * Split long speech into safe chunks while preserving start offsets in the
 * normalized source string (used to map boundary events back into the DOM).
 * @returns {Array<{ text: string, start: number }>}
 */
export function splitSpeechChunks(rawText, maxChars = DEFAULT_MAX_CHARS) {
  const source = normalizeText(rawText);
  const chunks = [];
  const safeMax = Math.max(40, Number(maxChars) || DEFAULT_MAX_CHARS);
  let cursor = 0;

  while (cursor < source.length) {
    const remaining = source.slice(cursor);
    if (remaining.length <= safeMax) {
      const text = normalizeText(remaining);
      if (text) chunks.push({ text, start: cursor });
      break;
    }
    const splitIndex = findSplitIndex(remaining, safeMax);
    const rawChunk = remaining.slice(0, splitIndex);
    const leading = rawChunk.match(/^\s*/)?.[0].length || 0;
    const text = normalizeText(rawChunk);
    if (text) chunks.push({ text, start: cursor + leading });
    cursor += splitIndex;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  }
  return chunks;
}

export function splitSpeechText(rawText, maxChars = DEFAULT_MAX_CHARS) {
  return splitSpeechChunks(rawText, maxChars).map((chunk) => chunk.text);
}

export function detectSpeechLanguage(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "en";
  const matches = normalized.match(CJK_RE)?.length || 0;
  return matches / normalized.length >= 0.15 ? "zh" : "en";
}

export function chooseNarrationVoice(
  voices,
  { text = "", accent = ARTICLE_NARRATION_ACCENT.US } = {},
) {
  const available = Array.isArray(voices) ? voices : [];
  const language = detectSpeechLanguage(text);
  const target =
    language === "zh"
      ? "zh"
      : normalizeArticleNarrationAccent(accent) === ARTICLE_NARRATION_ACCENT.UK
        ? "en-GB"
        : "en-US";
  const exactLanguage =
    target === "zh"
      ? /^zh[-_](CN|Hans)/i
      : new RegExp(`^${target.replace("-", "[-_]")}`, "i");
  const broadLanguage = target === "zh" ? /^zh/i : /^en/i;
  const candidates = available.filter((voice) => broadLanguage.test(voice.lang));
  if (candidates.length === 0) return null;

  const preferences = NATURAL_VOICE_PREFERENCES[target] || [];
  function scoreVoice(voice) {
    let score = exactLanguage.test(voice.lang) ? 300 : 0;
    const preferredIndex = preferences.findIndex((pattern) =>
      pattern.test(voice.name || ""),
    );
    if (preferredIndex >= 0) score += 1000 - preferredIndex * 20;
    if (/natural|premium|enhanced/i.test(voice.name || "")) score += 180;
    if (voice.localService) score += 15;
    if (voice.default) score += 5;
    if (NOVELTY_VOICE_RE.test(voice.name || "")) score -= 2000;
    return score;
  }

  return candidates.reduce((best, voice) =>
    scoreVoice(voice) > scoreVoice(best) ? voice : best,
  );
}

function resolveSectionSpeechMode(section, textIndex, mode) {
  if (mode === ARTICLE_NARRATION_MODE.TRANSLATION) {
    return ARTICLE_NARRATION_MODE.TRANSLATION;
  }
  if (mode === ARTICLE_NARRATION_MODE.BILINGUAL) {
    return textIndex === 0
      ? ARTICLE_NARRATION_MODE.ORIGINAL
      : ARTICLE_NARRATION_MODE.TRANSLATION;
  }
  return ARTICLE_NARRATION_MODE.ORIGINAL;
}

function buildNarrationQueue(sections, mode = ARTICLE_NARRATION_MODE.ORIGINAL) {
  const queue = [];
  sections.forEach((section, sectionIndex) => {
    section.texts.forEach((text, textIndex) => {
      const speechMode = resolveSectionSpeechMode(section, textIndex, mode);
      const charMap = buildSpeechCharMap(section.element, speechMode);
      // Prefer live DOM map text when it matches; otherwise fall back to the
      // already-extracted speech string (still speakable, word highlight may skip).
      const speechSource = charMap.text || text;
      splitSpeechChunks(speechSource).forEach((chunk) => {
        queue.push({
          element: section.element,
          text: chunk.text,
          textStart: chunk.start,
          charMap,
          speechMode,
          sectionIndex,
          totalSections: sections.length,
        });
      });
    });
  });
  return queue;
}

export function createArticleNarrator({
  root = globalThis.document?.body,
  speech = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  getStartElement = () => null,
  isUiElement = null,
  scrollCurrentIntoView = true,
  onOptionsChange = null,
  wordHighlighter = null,
} = {}) {
  const listeners = new Set();
  const highlighter = wordHighlighter || createNarrationWordHighlighter();
  let queue = [];
  let queueIndex = 0;
  let generation = 0;
  let currentUtterance = null;
  let currentElement = null;
  let wordFallbackTimers = [];
  let sawWordBoundary = false;
  let state = {
    status: ARTICLE_NARRATION_STATUS.IDLE,
    mode: ARTICLE_NARRATION_MODE.ORIGINAL,
    rate: 1,
    accent: ARTICLE_NARRATION_ACCENT.US,
    sectionIndex: 0,
    totalSections: 0,
    currentWord: "",
    error: "",
  };

  function getState() {
    return { ...state };
  }

  function emit() {
    const snapshot = getState();
    listeners.forEach((listener) => listener(snapshot));
  }

  function setState(patch) {
    state = { ...state, ...patch };
    emit();
  }

  function clearWordFallbackTimers() {
    for (const timer of wordFallbackTimers) {
      try {
        clearTimeout(timer);
      } catch {
        /* ignore */
      }
    }
    wordFallbackTimers = [];
  }

  function clearWordHighlight() {
    clearWordFallbackTimers();
    highlighter.clear();
  }

  function clearHighlight() {
    clearWordHighlight();
    currentElement?.classList?.remove("ollama-article-narration-current");
    currentElement = null;
  }

  function highlight(element) {
    if (!element || element === currentElement) return;
    clearWordHighlight();
    currentElement?.classList?.remove("ollama-article-narration-current");
    currentElement = element;
    currentElement.classList?.add("ollama-article-narration-current");
    if (!scrollCurrentIntoView) return;
    const rect = currentElement.getBoundingClientRect?.();
    if (
      rect &&
      (rect.top < 72 || rect.bottom > Math.max(72, window.innerHeight - 72))
    ) {
      currentElement.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }

  function applyWordHighlight(item, charIndex, charLength, spokenWord) {
    if (!item) return;
    const length = Math.max(1, Number(charLength) || 1);
    const index = Math.max(0, Number(charIndex) || 0);
    const word =
      String(spokenWord || "").trim() ||
      String(item.text || "")
        .slice(index, index + length)
        .trim();
    if (!word) return;

    const range = resolveSpokenWordRange({
      element: item.element,
      mode: item.speechMode || ARTICLE_NARRATION_MODE.ORIGINAL,
      charIndex: index,
      charLength: length,
      textStart: item.textStart,
      word,
      cachedCharMap: item.charMap,
    });
    if (range) {
      highlighter.highlightRange(range);
      // Keep a live map for the next word after recognition re-wraps.
      try {
        item.charMap = buildSpeechCharMap(
          item.element,
          item.speechMode || ARTICLE_NARRATION_MODE.ORIGINAL,
        );
      } catch {
        /* ignore */
      }
    }

    if (word !== state.currentWord) {
      setState({ currentWord: word });
    }
  }

  function highlightWordFromBoundary(item, utterance, event) {
    if (!item || !isWordBoundaryEvent(event)) return;
    sawWordBoundary = true;
    clearWordFallbackTimers();
    const charIndex = Math.max(0, Number(event.charIndex) || 0);
    const charLength =
      Math.max(0, Number(event.charLength) || 0) ||
      inferWordLength(utterance?.text || item.text, charIndex);
    if (!charLength) return;
    applyWordHighlight(item, charIndex, charLength);
  }

  /**
   * Many macOS / remote voices never fire word boundaries. Walk spoken words
   * on a timer so the page still gets a readable yellow mark.
   */
  function scheduleWordFallback(item, token) {
    clearWordFallbackTimers();
    sawWordBoundary = false;
    const spans = listSpeechWordSpans(item.text);
    if (spans.length === 0) return;
    const rate = Math.max(0.5, Number(state.rate) || 1);
    const msPerChar = 68 / rate;
    let delay = 90;
    for (const span of spans) {
      const wait = delay;
      delay += Math.max(110, span.length * msPerChar + 40);
      const timer = setTimeout(() => {
        if (token !== generation || sawWordBoundary) return;
        if (currentUtterance == null) return;
        applyWordHighlight(item, span.start, span.length, span.word);
      }, wait);
      wordFallbackTimers.push(timer);
    }
  }

  function cancelSpeech() {
    generation += 1;
    currentUtterance = null;
    clearWordFallbackTimers();
    try {
      speech?.cancel?.();
    } catch (_) {}
  }

  function finish() {
    cancelSpeech();
    queue = [];
    queueIndex = 0;
    clearHighlight();
    setState({
      status: ARTICLE_NARRATION_STATUS.IDLE,
      sectionIndex: 0,
      totalSections: 0,
      currentWord: "",
      error: "",
    });
  }

  function fail(message) {
    cancelSpeech();
    queue = [];
    queueIndex = 0;
    clearHighlight();
    setState({
      status: ARTICLE_NARRATION_STATUS.ERROR,
      sectionIndex: 0,
      totalSections: 0,
      currentWord: "",
      error: message || "朗读失败，请重试。",
    });
  }

  function speakCurrent() {
    if (queueIndex >= queue.length) {
      finish();
      return;
    }
    const item = queue[queueIndex];
    const token = generation;
    const utterance = new Utterance(item.text);
    currentUtterance = utterance;
    utterance.rate = state.rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = chooseNarrationVoice(speech?.getVoices?.() || [], {
      text: item.text,
      accent: state.accent,
    });
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ||
      (detectSpeechLanguage(item.text) === "zh"
        ? "zh-CN"
        : state.accent === ARTICLE_NARRATION_ACCENT.UK
          ? "en-GB"
          : "en-US");
    highlight(item.element);
    setState({
      status: ARTICLE_NARRATION_STATUS.PLAYING,
      sectionIndex: item.sectionIndex + 1,
      totalSections: item.totalSections,
      currentWord: "",
      error: "",
    });

    utterance.onboundary = (event) => {
      if (token !== generation || currentUtterance !== utterance) return;
      highlightWordFromBoundary(item, utterance, event);
    };
    utterance.onend = () => {
      if (token !== generation || currentUtterance !== utterance) return;
      clearWordFallbackTimers();
      clearWordHighlight();
      queueIndex += 1;
      speakCurrent();
    };
    utterance.onerror = (event) => {
      if (token !== generation || currentUtterance !== utterance) return;
      const code = String(event?.error || "");
      if (code === "canceled" || code === "interrupted") return;
      fail(code === "not-allowed" ? "浏览器阻止了语音播放，请在页面上点击朗读。" : "朗读失败，请重试。");
    };

    try {
      speech.speak(utterance);
      scheduleWordFallback(item, token);
    } catch (_) {
      fail("当前浏览器无法启动文章朗读。");
    }
  }

  function start({
    fromElement = null,
    contentClickTarget = null,
    preferResolvedAnchor = true,
  } = {}) {
    if (!speech?.speak || !Utterance || !root) {
      fail("当前浏览器不支持文章朗读。");
      return { ok: false, error: state.error, state: getState() };
    }
    cancelSpeech();
    clearHighlight();

    let startElement = fromElement;
    let startSource = fromElement ? "explicit" : "document-start";
    if (preferResolvedAnchor || !fromElement) {
      const anchor = resolveNarrationStartAnchor({
        explicit: fromElement,
        contentClickTarget:
          contentClickTarget ??
          (typeof getStartElement === "function" ? getStartElement() : null),
        document: root?.ownerDocument || globalThis.document,
        isUiElement,
      });
      startElement = anchor.element;
      startSource = anchor.source;
    }

    const sections = collectArticleNarrationSections(root, {
      mode: state.mode,
      startElement,
      isUiElement,
    });
    queue = buildNarrationQueue(sections, state.mode);
    queueIndex = 0;
    if (queue.length === 0) {
      const message =
        state.mode === ARTICLE_NARRATION_MODE.TRANSLATION
          ? "当前页面还没有可朗读的译文。"
          : "当前页面没有找到可朗读的文章内容。";
      fail(message);
      return { ok: false, error: message, state: getState() };
    }

    const firstElement = queue[0]?.element;
    if (firstElement) flashNarrationStart(firstElement);

    speakCurrent();
    const result = { ok: true, state: getState(), startSource };
    if (startSource === "document-start") {
      result.notice = "未指定位置，已从文章开头朗读";
    } else if (startSource === "viewport") {
      result.notice = "已从当前屏幕可见段落开始朗读";
    }
    return result;
  }

  function pause() {
    if (state.status !== ARTICLE_NARRATION_STATUS.PLAYING) return getState();
    try {
      speech.pause?.();
      setState({ status: ARTICLE_NARRATION_STATUS.PAUSED });
    } catch (_) {}
    return getState();
  }

  function resume() {
    if (state.status !== ARTICLE_NARRATION_STATUS.PAUSED) return getState();
    try {
      speech.resume?.();
      setState({ status: ARTICLE_NARRATION_STATUS.PLAYING });
    } catch (_) {}
    return getState();
  }

  function togglePause() {
    return state.status === ARTICLE_NARRATION_STATUS.PAUSED
      ? resume()
      : pause();
  }

  function stop() {
    finish();
    return getState();
  }

  function setOptions(nextOptions = {}, { restart = true } = {}) {
    const next = {
      mode: normalizeArticleNarrationMode(nextOptions.mode ?? state.mode),
      rate: normalizeArticleNarrationRate(nextOptions.rate ?? state.rate),
      accent: normalizeArticleNarrationAccent(
        nextOptions.accent ?? state.accent,
      ),
    };
    const changed =
      next.mode !== state.mode ||
      next.rate !== state.rate ||
      next.accent !== state.accent;
    state = { ...state, ...next };
    if (!changed) return getState();
    onOptionsChange?.({ ...next });
    const wasActive =
      state.status === ARTICLE_NARRATION_STATUS.PLAYING ||
      state.status === ARTICLE_NARRATION_STATUS.PAUSED ||
      state.status === ARTICLE_NARRATION_STATUS.ERROR;
    if (restart && wasActive) {
      return start({ fromElement: currentElement });
    }
    emit();
    return getState();
  }

  function onStateChange(listener) {
    listeners.add(listener);
    listener(getState());
    return () => listeners.delete(listener);
  }

  function destroy() {
    cancelSpeech();
    clearHighlight();
    highlighter.destroy?.();
    listeners.clear();
  }

  return {
    destroy,
    getState,
    onStateChange,
    pause,
    resume,
    setOptions,
    start,
    stop,
    togglePause,
  };
}
