/**
 * 英语生词标记 - content 端
 *
 * 功能：
 *  - 加载 studyingWords，对其中"当前可见"（已过 nextReviewAt）的词
 *    在文本节点中用 <span class="ai-tr-word"> 包裹，显示带间距的边框方框。
 *  - 认词模式下，除 knownWords 外的英文单词都会显示边框标记。
 *  - 鼠标悬停 + 短停留 → 弹出小卡片：音标、发音按钮、记得/忘记/我知道按钮。
 *  - 单词状态变化时只更新同词标记；模式开关或批量导入时才完整重扫。
 */
import {
  STUDYING_WORDS_STORAGE_KEY,
  KNOWN_WORDS_STORAGE_KEY,
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
  normalizeWord,
} from "../shared/word-learning.js";
import { buildYoudaoAudioUrl } from "../shared/youdao-api.js";
import {
  isWordMarkerActive,
  resolveWordMarkKind,
  WORD_MARK_KIND,
} from "./wordMarkerPolicy.js";
import { resolveWordMarkerCardShortcut } from "./wordMarkerShortcuts.js";
import { WORD_LEARNING_STATUS } from "./tip/wordLearningActions.js";
import {
  BUTTON_ID,
  HOVER_TARGET_INDICATOR_ID,
  SHORTCUT_HINT_ID,
  TIP_ID,
  WORD_MARKER_CARD_ID,
  WORD_MARKER_SPAN_CLASS,
} from "./constants.js";

const WORD_SPAN_CLASS = WORD_MARKER_SPAN_CLASS;
const WORD_ACTIVE_CLASS = `${WORD_SPAN_CLASS}--active`;
const WORD_LINK_CLASS = `${WORD_SPAN_CLASS}--link`;
const WORD_LINK_COLOR_PROPERTY = "--ai-tr-word-link-color";
const WORD_STYLE_TAG_ID = "__ai_translate_word_marker_style__";
const CARD_ID = WORD_MARKER_CARD_ID;
const EXTENSION_UI_SELECTOR = [
  `#${BUTTON_ID}`,
  `#${TIP_ID}`,
  `#${SHORTCUT_HINT_ID}`,
  `#${HOVER_TARGET_INDICATOR_ID}`,
  `#${WORD_MARKER_CARD_ID}`,
  "#__ai_translate_ui_rewrite_overlay__",
  "#ollama-pt-bar",
].join(", ");
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "CODE",
  "PRE",
  "OPTION",
  "SELECT",
  "BUTTON",
]);

const WORD_REGEX = /[A-Za-z][A-Za-z'\-]{0,30}/g;
const ASCII_IDENTIFIER_CHAR_REGEX = /[A-Za-z0-9_]/;

export function collectMarkableEnglishWords(rawText) {
  const text = String(rawText || "");
  const matches = [];
  WORD_REGEX.lastIndex = 0;
  let match;

  while ((match = WORD_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const previousChar = start > 0 ? text[start - 1] : "";
    const nextChar = end < text.length ? text[end] : "";

    // Git 哈希、版本号和变量名中的字母片段不是独立英语单词。
    if (
      ASCII_IDENTIFIER_CHAR_REGEX.test(previousChar) ||
      ASCII_IDENTIFIER_CHAR_REGEX.test(nextChar)
    ) {
      continue;
    }

    const word = normalizeWord(match[0]);
    if (!word) continue;
    matches.push({ raw: match[0], word, index: start, end });
  }

  return matches;
}

function ensureWordStyles() {
  if (document.getElementById(WORD_STYLE_TAG_ID)) return;
  const style = document.createElement("style");
  style.id = WORD_STYLE_TAG_ID;
  style.textContent = `
    .${WORD_SPAN_CLASS}{
      display:inline-block;
      box-sizing:border-box;
      margin:0 .08em;
      padding:.02em .2em;
      border:1px solid rgba(99,102,241,.72);
      border-radius:4px;
      background:rgba(99,102,241,.07);
      line-height:1.25;
      vertical-align:baseline;
      cursor:help;
    }
    .${WORD_SPAN_CLASS}.${WORD_SPAN_CLASS}--studying{
      border-color:rgba(245,158,11,.9);
      background:rgba(245,158,11,.1);
    }
    a.${WORD_LINK_CLASS}:hover{
      color:var(${WORD_LINK_COLOR_PROPERTY}) !important;
    }
    .${WORD_SPAN_CLASS}.${WORD_ACTIVE_CLASS}{
      color:#4f46e5 !important;
      background:rgba(99,102,241,.16);
      border-color:rgba(79,70,229,.9);
      box-shadow:0 0 0 2px rgba(99,102,241,.12);
    }
    #${CARD_ID}{
      position:absolute; z-index:2147483645;
      box-sizing:border-box;
      background:#1a1a1f; color:#fafafa;
      border:1px solid #2a2a30; border-radius:10px;
      padding:10px 12px;
      min-width:min(200px, calc(100vw - 16px));
      max-width:min(300px, calc(100vw - 16px));
      height:auto; overflow:visible;
      box-shadow:0 12px 32px rgba(0,0,0,0.45);
      font:13px -apple-system,"Segoe UI",sans-serif;
      line-height:1.45;
    }
    #${CARD_ID} .ai-tr-card-word{font-size:15px;font-weight:600;margin-bottom:4px;color:#fff}
    #${CARD_ID} .ai-tr-card-phon{color:#a1a1aa;font-size:12px;margin-bottom:6px;display:flex;gap:10px;flex-wrap:wrap}
    #${CARD_ID} .ai-tr-card-phon button{background:transparent;border:0;color:#8ab4f8;cursor:pointer;padding:0;font:inherit}
    #${CARD_ID} .ai-tr-card-phon button.is-playing{color:#a5b4fc}
    #${CARD_ID} .ai-tr-card-phon button.is-error{color:#fca5a5}
    #${CARD_ID} .ai-tr-card-tr{color:#d4d4d8;font-size:12px;margin-bottom:8px;max-height:none;overflow:visible;overflow-wrap:anywhere}
    #${CARD_ID} .ai-tr-card-actions{display:flex;gap:6px;flex-wrap:wrap}
    #${CARD_ID} .ai-tr-card-actions button{flex:1 1 auto;display:inline-flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #27272a;background:#222228;color:#fafafa;border-radius:6px;padding:5px 8px;font:inherit;cursor:pointer;font-size:12px}
    #${CARD_ID} .ai-tr-card-actions kbd{color:#71717a;background:transparent;border:0;font:inherit;font-size:10px}
    #${CARD_ID} .ai-tr-card-actions button.primary{background:linear-gradient(135deg,#22c55e,#16a34a);border-color:transparent}
    #${CARD_ID} .ai-tr-card-actions button.warn{background:#3a2a2a;border-color:#5a2a2a;color:#fca5a5}
    #${CARD_ID} .ai-tr-card-actions button.known{background:#1f3a2a;border-color:#22c55e44;color:#86efac}
    @media (prefers-color-scheme: light){
      .${WORD_SPAN_CLASS}{background:rgba(79,70,229,.06);border-color:rgba(79,70,229,.68)}
      .${WORD_SPAN_CLASS}.${WORD_SPAN_CLASS}--studying{background:rgba(217,119,6,.08);border-color:rgba(217,119,6,.82)}
      #${CARD_ID}{background:#fff;color:#111;border-color:#d6dce8;box-shadow:0 12px 32px rgba(15,23,42,.18)}
      #${CARD_ID} .ai-tr-card-word{color:#111}
      #${CARD_ID} .ai-tr-card-phon{color:#475569}
      #${CARD_ID} .ai-tr-card-tr{color:#1f2937}
      #${CARD_ID} .ai-tr-card-actions button{background:#f1f5f9;border-color:#cbd5e1;color:#0f172a}
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

export function shouldSkipWordMarkerNode(node) {
  if (!node || !node.parentNode) return true;
  let p = node.parentNode;
  while (p && p.nodeType === 1) {
    if (SKIP_TAGS.has(p.tagName)) return true;
    if (p.isContentEditable) return true;
    if (p.classList?.contains(WORD_SPAN_CLASS)) return true;
    if (p.id === CARD_ID) return true;
    if (p.closest?.(EXTENSION_UI_SELECTOR)) return true;
    p = p.parentNode;
  }
  return false;
}

export function calculateRecognitionStats(root, knownWords = {}) {
  if (!root) {
    return { knownCount: 0, totalCount: 0, percentage: 0 };
  }

  let knownCount = 0;
  let totalCount = 0;
  const countedMarkers = new Set();
  const ownerDocument = root.ownerDocument || document;
  const nodeFilter =
    ownerDocument.defaultView?.NodeFilter || globalThis.NodeFilter;
  if (!nodeFilter) {
    return { knownCount: 0, totalCount: 0, percentage: 0 };
  }
  const walker = ownerDocument.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  let node;

  function countWord(rawWord) {
    const word = normalizeWord(rawWord);
    if (!word) return;
    totalCount += 1;
    if (knownWords?.[word]) knownCount += 1;
  }

  while ((node = walker.nextNode())) {
    const markedWordElement = node.parentElement?.closest?.(
      `.${WORD_SPAN_CLASS}`,
    );
    if (markedWordElement) {
      if (!countedMarkers.has(markedWordElement)) {
        countedMarkers.add(markedWordElement);
        countWord(
          markedWordElement.dataset.word || markedWordElement.textContent,
        );
      }
      continue;
    }
    if (shouldSkipWordMarkerNode(node)) continue;

    for (const match of collectMarkableEnglishWords(node.nodeValue)) {
      countWord(match.word);
    }
  }

  return {
    knownCount,
    totalCount,
    percentage:
      totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0,
  };
}

function unwrapAllMarks(root = document.body) {
  if (!root) return;
  clearActiveWordSpan();
  const nodes = root.querySelectorAll(`.${WORD_SPAN_CLASS}`);
  nodes.forEach((node) => {
    const text = document.createTextNode(node.textContent || "");
    node.replaceWith(text);
  });
  cleanupWordMarkerLinks(root);
}

export function prepareWordMarkerLink(link) {
  if (!link || link.tagName !== "A") return null;
  if (!link.classList.contains(WORD_LINK_CLASS)) {
    const view = link.ownerDocument?.defaultView;
    const color = view?.getComputedStyle?.(link)?.color || "currentColor";
    link.style.setProperty(WORD_LINK_COLOR_PROPERTY, color);
    link.classList.add(WORD_LINK_CLASS);
  }
  return link;
}

export function cleanupWordMarkerLinks(root) {
  if (!root?.querySelectorAll) return;
  const links = root.querySelectorAll(`.${WORD_LINK_CLASS}`);
  links.forEach((link) => {
    link.classList.remove(WORD_LINK_CLASS);
    link.style.removeProperty(WORD_LINK_COLOR_PROPERTY);
  });
}

function markTextNode(node, markerContext, onlyWord = "") {
  const text = node.nodeValue;
  if (!text) return;
  const ownerDocument = node.ownerDocument || globalThis.document;
  if (!ownerDocument) return;
  let lastIndex = 0;
  let frag = null;
  for (const match of collectMarkableEnglishWords(text)) {
    const { raw, word: lower } = match;
    if (onlyWord && lower !== onlyWord) continue;
    const markKind = resolveWordMarkKind(lower, markerContext);
    if (!markKind) continue;
    if (!frag) frag = ownerDocument.createDocumentFragment();
    if (match.index > lastIndex) {
      frag.appendChild(
        ownerDocument.createTextNode(text.slice(lastIndex, match.index)),
      );
    }
    const span = ownerDocument.createElement("span");
    span.className = `${WORD_SPAN_CLASS} ${WORD_SPAN_CLASS}--${markKind}`;
    span.dataset.word = lower;
    span.dataset.markKind = markKind;
    if (markerContext.recognitionModeEnabled) {
      span.dataset.recognitionMode = "true";
    }
    span.textContent = raw;
    frag.appendChild(span);
    lastIndex = match.end;
  }
  if (frag) {
    prepareWordMarkerLink(node.parentElement?.closest?.("a"));
    if (lastIndex < text.length) {
      frag.appendChild(ownerDocument.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

function scanAndMark(root, markerContext, onlyWord = "") {
  if (!root || !isWordMarkerActive(markerContext)) return;
  const ownerDocument = root.ownerDocument || globalThis.document;
  const nodeFilter =
    ownerDocument?.defaultView?.NodeFilter || globalThis.NodeFilter;
  if (!ownerDocument || !nodeFilter) return;
  const walker = ownerDocument.createTreeWalker(root, nodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkipWordMarkerNode(node)) return nodeFilter.FILTER_REJECT;
      if (!node.nodeValue) {
        return nodeFilter.FILTER_REJECT;
      }
      return nodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) markTextNode(node, markerContext, onlyWord);
}

function cleanupLinkIfUnmarked(link) {
  if (!link?.classList?.contains(WORD_LINK_CLASS)) return;
  if (link.querySelector?.(`.${WORD_SPAN_CLASS}`)) return;
  link.classList.remove(WORD_LINK_CLASS);
  link.style.removeProperty(WORD_LINK_COLOR_PROPERTY);
}

export function updateWordMarkersForWord(root, rawWord, markerContext = {}) {
  if (!root?.querySelectorAll) return 0;
  const word = normalizeWord(rawWord);
  if (!word) return 0;
  const markKind = resolveWordMarkKind(word, markerContext);
  const matchingSpans = Array.from(
    root.querySelectorAll(`.${WORD_SPAN_CLASS}`),
  ).filter((span) => (span.dataset.word || "").toLowerCase() === word);
  const affectedLinks = new Set();

  for (const span of matchingSpans) {
    const link = span.closest?.("a");
    if (link) affectedLinks.add(link);
    if (!markKind) {
      const ownerDocument = span.ownerDocument || globalThis.document;
      if (!ownerDocument) continue;
      span.replaceWith(ownerDocument.createTextNode(span.textContent || ""));
      continue;
    }
    span.classList.remove(
      `${WORD_SPAN_CLASS}--${WORD_MARK_KIND.STUDYING}`,
      `${WORD_SPAN_CLASS}--${WORD_MARK_KIND.RECOGNITION}`,
    );
    span.classList.add(`${WORD_SPAN_CLASS}--${markKind}`);
    span.dataset.markKind = markKind;
    if (markerContext.recognitionModeEnabled) {
      span.dataset.recognitionMode = "true";
    } else {
      delete span.dataset.recognitionMode;
    }
  }

  for (const link of affectedLinks) cleanupLinkIfUnmarked(link);
  if (markKind) scanAndMark(root, markerContext, word);
  return matchingSpans.length;
}

export function applyWordStatusToMarkerContext(
  markerContext,
  rawWord,
  status,
  entry = null,
) {
  const word = normalizeWord(rawWord);
  if (!word) return markerContext;
  const knownWords = { ...(markerContext?.knownWords || {}) };
  const studyingWords = { ...(markerContext?.studyingWords || {}) };

  if (status === "known") {
    knownWords[word] = knownWords[word] || entry || { addedAt: Date.now() };
    delete studyingWords[word];
  } else if (status === "studying") {
    delete knownWords[word];
    studyingWords[word] =
      entry ||
      studyingWords[word] || {
        addedAt: Date.now(),
        level: -1,
        lastReviewedAt: null,
        nextReviewAt: null,
        lastAction: null,
        history: [],
      };
  } else if (status === "unmarked") {
    delete knownWords[word];
    delete studyingWords[word];
  } else {
    return markerContext;
  }

  return { ...markerContext, knownWords, studyingWords };
}

function wordEntryChanged(previous, next) {
  return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null);
}

export function collectChangedWordKeys(changes = {}) {
  const words = new Set();
  for (const key of [KNOWN_WORDS_STORAGE_KEY, STUDYING_WORDS_STORAGE_KEY]) {
    if (!(key in changes)) continue;
    const previous = changes[key]?.oldValue || {};
    const next = changes[key]?.newValue || {};
    for (const word of new Set([
      ...Object.keys(previous),
      ...Object.keys(next),
    ])) {
      if (wordEntryChanged(previous[word], next[word])) words.add(word);
    }
  }
  return [...words];
}

let cardEl = null;
let cardWord = "";
let cardMarkKind = "";
let activeWordSpan = null;
let pronunciationAudio = null;
let pronunciationButton = null;

function setActiveWordSpan(span) {
  if (activeWordSpan === span) return;
  activeWordSpan?.classList?.remove(WORD_ACTIVE_CLASS);
  activeWordSpan = span || null;
  activeWordSpan?.classList?.add(WORD_ACTIVE_CLASS);
}

function clearActiveWordSpan() {
  activeWordSpan?.classList?.remove(WORD_ACTIVE_CLASS);
  activeWordSpan = null;
}

function restorePronunciationButton(button = pronunciationButton) {
  if (!button) return;
  button.textContent = button.dataset.idleLabel || button.textContent;
  button.classList.remove("is-playing", "is-error");
  button.title = "播放发音";
}

function stopPronunciation() {
  const audio = pronunciationAudio;
  pronunciationAudio = null;
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {
      // 某些浏览器在音频元数据尚未加载时不允许修改 currentTime。
    }
  }
  restorePronunciationButton();
  pronunciationButton = null;
}

function hideCard() {
  stopPronunciation();
  clearActiveWordSpan();
  if (cardEl) {
    cardEl.remove();
    cardEl = null;
    cardWord = "";
    cardMarkKind = "";
  }
}

function sendBg(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function playAudio(word, type, button) {
  try {
    if (pronunciationAudio && pronunciationButton === button) {
      stopPronunciation();
      return;
    }
    stopPronunciation();

    const audio = new Audio(buildYoudaoAudioUrl(word, type));
    const idleLabel = button?.textContent || "▶︎";
    if (button) {
      button.dataset.idleLabel = idleLabel;
      button.textContent = idleLabel.replace("▶︎", "■");
      button.classList.add("is-playing");
      button.title = "停止播放";
    }
    pronunciationAudio = audio;
    pronunciationButton = button || null;

    const finish = () => {
      if (pronunciationAudio !== audio) return;
      pronunciationAudio = null;
      restorePronunciationButton(button);
      pronunciationButton = null;
    };
    const fail = () => {
      if (pronunciationAudio !== audio) return;
      pronunciationAudio = null;
      if (button) {
        button.textContent = idleLabel.replace("▶︎", "重试");
        button.classList.remove("is-playing");
        button.classList.add("is-error");
        button.title = "播放失败，点击重试";
        window.setTimeout(() => {
          if (!pronunciationAudio && button.isConnected) {
            restorePronunciationButton(button);
          }
        }, 1200);
      }
      pronunciationButton = null;
    };
    audio.onended = finish;
    audio.onerror = fail;
    audio.play().catch(fail);
  } catch (_) {
    pronunciationAudio = null;
    pronunciationButton = null;
    if (button) {
      button.textContent = button.dataset.idleLabel || button.textContent;
      button.classList.remove("is-playing");
      button.classList.add("is-error");
      button.title = "播放失败，点击重试";
    }
  }
}

export function resolveWordMarkerCardPosition({
  anchorRect,
  cardWidth,
  cardHeight,
  viewportWidth,
  viewportHeight,
  scrollX = 0,
  scrollY = 0,
  safeMargin = 8,
  gap = 6,
}) {
  const maxLeft = Math.max(safeMargin, viewportWidth - cardWidth - safeMargin);
  const viewportLeft = Math.min(
    Math.max(anchorRect.left, safeMargin),
    maxLeft,
  );
  const below = anchorRect.bottom + gap;
  const above = anchorRect.top - gap - cardHeight;
  const maxTop = Math.max(safeMargin, viewportHeight - cardHeight - safeMargin);
  let viewportTop = below;

  if (below + cardHeight > viewportHeight - safeMargin) {
    viewportTop = above >= safeMargin ? above : maxTop;
  }
  viewportTop = Math.min(Math.max(viewportTop, safeMargin), maxTop);

  return {
    left: scrollX + viewportLeft,
    top: scrollY + viewportTop,
  };
}

function positionCard(card, anchor) {
  const anchorRect = anchor.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const { left, top } = resolveWordMarkerCardPosition({
    anchorRect,
    cardWidth: cardRect.width,
    cardHeight: cardRect.height,
    viewportWidth: document.documentElement.clientWidth || window.innerWidth,
    viewportHeight: document.documentElement.clientHeight || window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  });
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function buildCardHtml(word, markKind) {
  const actions =
    markKind === WORD_MARK_KIND.STUDYING
      ? `
        <button data-act="forget" class="warn" title="点击后 1h 内仍标记">忘记</button>
        <button data-act="remember" class="primary" title="点击后按记忆梯度延后">记得</button>
        <button data-act="known" class="known" title="加入「我知道的单词」">我会</button>
      `
      : `
        <button data-act="studying" class="warn" title="加入生词（Option+1）"><span>加入生词</span><kbd>⌥1</kbd></button>
        <button data-act="known" class="known" title="标记为熟词（Option+2）"><span>我会</span><kbd>⌥2</kbd></button>
      `;
  return `
    <div class="ai-tr-card-word">${escapeHtml(word)}</div>
    <div class="ai-tr-card-phon" data-role="phon">加载中…</div>
    <div class="ai-tr-card-tr" data-role="tr"></div>
    <div class="ai-tr-card-actions">
      ${actions}
    </div>
  `;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch];
  });
}

async function showCardFor(span, word, markKind) {
  ensureWordStyles();
  if (cardEl && cardWord === word && cardMarkKind === markKind) {
    positionCard(cardEl, span);
    return;
  }
  hideCard();
  setActiveWordSpan(span);
  const card = document.createElement("div");
  card.id = CARD_ID;
  card.innerHTML = buildCardHtml(word, markKind);
  document.body.appendChild(card);
  cardEl = card;
  cardWord = word;
  cardMarkKind = markKind;
  positionCard(card, span);

  card.addEventListener("mouseleave", scheduleHide);
  card.addEventListener("mouseenter", cancelHide);

  card.addEventListener("click", async (event) => {
    const actionElement = event.target?.closest?.("[data-act]");
    const act = actionElement?.dataset?.act;
    if (!act) return;
    if (act === "remember") {
      await sendBg({ action: "reviewWord", word, reviewAction: "remember" });
      hideCard();
    } else if (act === "forget") {
      await sendBg({ action: "reviewWord", word, reviewAction: "forget" });
      hideCard();
    } else if (act === "studying") {
      await setCardWordLearningStatus(
        word,
        WORD_LEARNING_STATUS.STUDYING,
      );
    } else if (act === "known") {
      await setCardWordLearningStatus(word, WORD_LEARNING_STATUS.KNOWN);
    } else if (act === "play-uk") {
      playAudio(word, 1, actionElement);
    } else if (act === "play-us") {
      playAudio(word, 2, actionElement);
    }
  });

  const res = await sendBg({ action: "lookupWord", word });
  if (cardEl !== card) return;
  const phonEl = card.querySelector('[data-role="phon"]');
  const trEl = card.querySelector('[data-role="tr"]');
  if (res?.ok) {
    const parts = [];
    if (res.ukphone) {
      parts.push(
        `<span>UK /${escapeHtml(res.ukphone)}/</span><button data-act="play-uk">▶︎</button>`,
      );
    } else {
      parts.push(`<button data-act="play-uk">UK ▶︎</button>`);
    }
    if (res.usphone) {
      parts.push(
        `<span>US /${escapeHtml(res.usphone)}/</span><button data-act="play-us">▶︎</button>`,
      );
    } else {
      parts.push(`<button data-act="play-us">US ▶︎</button>`);
    }
    if (phonEl) phonEl.innerHTML = parts.join(" ");
    if (trEl) {
      const trans = (res.translations || []).slice(0, 5);
      trEl.innerHTML = trans.length
        ? trans.map((t) => escapeHtml(t)).join("<br>")
        : '<span style="color:#71717a">（无释义）</span>';
    }
  } else {
    if (phonEl) {
      phonEl.innerHTML = `
        <button data-act="play-uk">UK ▶︎</button>
        <button data-act="play-us">US ▶︎</button>
      `;
    }
    if (trEl) {
      trEl.innerHTML = `<span style="color:#fca5a5">${escapeHtml(res?.error || "查询失败")}</span>`;
    }
  }
  positionCard(card, span);
}

async function setCardWordLearningStatus(word, status) {
  await sendBg({
    action: "setWordLearningStatus",
    word,
    status,
  });
  hideCard();
}

let hoverTimer = 0;
let hideTimer = 0;
function scheduleHide() {
  cancelHide();
  hideTimer = window.setTimeout(hideCard, 220);
}
function cancelHide() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = 0;
  }
}

export function dismissWordMarkerCard() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = 0;
  }
  cancelHide();
  hideCard();
}

function onMouseOver(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (cardEl && cardEl.contains(target)) {
    cancelHide();
    return;
  }
  const span = target.classList?.contains(WORD_SPAN_CLASS)
    ? target
    : target.closest?.(`.${WORD_SPAN_CLASS}`);
  if (!span) return;
  setActiveWordSpan(span);
  cancelHide();
  if (hoverTimer) clearTimeout(hoverTimer);
  const word = span.dataset.word || normalizeWord(span.textContent || "");
  if (!word) return;
  const markKind = span.dataset.markKind || WORD_MARK_KIND.RECOGNITION;
  hoverTimer = window.setTimeout(() => {
    void showCardFor(span, word, markKind);
  }, 180);
}

function onMouseOut(event) {
  const related = event.relatedTarget;
  if (cardEl && (related === cardEl || cardEl.contains?.(related))) return;
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = 0;
  }
  scheduleHide();
}

function onScroll() {
  if (cardEl && cardWord) {
    const span = document.querySelector(
      `.${WORD_SPAN_CLASS}[data-word="${cardWord}"]`,
    );
    if (span) positionCard(cardEl, span);
  }
}

let mutationObserver = null;
let mutationDebounce = 0;
let rescanVersion = 0;
let markerContextCache = {
  knownWords: {},
  studyingWords: {},
  wordMarkingEnabled: false,
  recognitionModeEnabled: false,
};
let recognitionStatsListener = null;

function emitRecognitionStats() {
  if (typeof recognitionStatsListener !== "function") return;
  if (!markerContextCache.recognitionModeEnabled) {
    recognitionStatsListener(null);
    return;
  }
  recognitionStatsListener(
    calculateRecognitionStats(document.body, markerContextCache.knownWords),
  );
}

function ensureMutationObserver() {
  if (mutationObserver) return;
  mutationObserver = new MutationObserver((mutations) => {
    if (!isWordMarkerActive(markerContextCache)) return;
    const roots = new Set();
    let shouldRefreshStats = false;
    for (const m of mutations) {
      if (m.addedNodes?.length || m.removedNodes?.length) {
        shouldRefreshStats = true;
      }
      for (const node of m.addedNodes || []) {
        if (
          node.nodeType === 1 &&
          !shouldSkipWordMarkerNode(node.firstChild || node)
        ) {
          roots.add(node);
        }
      }
    }
    if (roots.size === 0 && !shouldRefreshStats) return;
    if (mutationDebounce) clearTimeout(mutationDebounce);
    mutationDebounce = window.setTimeout(() => {
      for (const root of roots) scanAndMark(root, markerContextCache);
      emitRecognitionStats();
    }, 250);
  });
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
  });
}

async function rescan() {
  const nextVersion = ++rescanVersion;
  if (!isWordMarkerActive(markerContextCache)) {
    unwrapAllMarks();
    hideCard();
    emitRecognitionStats();
    return;
  }
  ensureWordStyles();
  unwrapAllMarks();
  const res = await sendBg({ action: "getAllWords" });
  if (nextVersion !== rescanVersion || !isWordMarkerActive(markerContextCache)) {
    return;
  }
  if (!res?.ok) {
    emitRecognitionStats();
    return;
  }
  markerContextCache = {
    ...markerContextCache,
    knownWords: res?.known || {},
    studyingWords: res?.studying || {},
  };
  scanAndMark(document.body, markerContextCache);
  emitRecognitionStats();
  ensureMutationObserver();
}

async function readMarkerSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [WORD_MARKING_ENABLED_KEY, WORD_RECOGNITION_MODE_ENABLED_KEY],
      (value) => {
        resolve({
          wordMarkingEnabled: value?.[WORD_MARKING_ENABLED_KEY] === true,
          recognitionModeEnabled:
            value?.[WORD_RECOGNITION_MODE_ENABLED_KEY] === true,
        });
      },
    );
  });
}

export function initWordMarker({ onRecognitionStatsChange } = {}) {
  ensureWordStyles();
  recognitionStatsListener =
    typeof onRecognitionStatsChange === "function"
      ? onRecognitionStatsChange
      : null;

  void (async () => {
    markerContextCache = {
      ...markerContextCache,
      ...(await readMarkerSettings()),
    };
    if (isWordMarkerActive(markerContextCache)) await rescan();
    else emitRecognitionStats();
  })();

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  document.addEventListener("keydown", onWordMarkerShortcut, true);
  window.addEventListener("scroll", onScroll, { passive: true });

  function onWordMarkerShortcut(event) {
    const shortcut = resolveWordMarkerCardShortcut(event, cardWord);
    if (!shortcut || !cardEl?.isConnected) return;
    event.preventDefault();
    event.stopPropagation();
    void setCardWordLearningStatus(shortcut.word, shortcut.status);
  }

  function onMessage(msg) {
    if (!msg) return;
    if (msg.action === "wordsChanged") {
      const word = normalizeWord(msg.word);
      if (word && ["known", "studying", "unmarked"].includes(msg.status)) {
        markerContextCache = applyWordStatusToMarkerContext(
          markerContextCache,
          word,
          msg.status,
          msg.entry,
        );
        updateWordMarkersForWord(document.body, word, markerContextCache);
        hideCard();
        emitRecognitionStats();
      } else {
        void rescan();
      }
    } else if (msg.action === "wordMarkingEnabledChanged") {
      markerContextCache = {
        ...markerContextCache,
        wordMarkingEnabled: !!msg.enabled,
      };
      void rescan();
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);

  function onStorage(changes, area) {
    if (
      area === "sync" &&
      (WORD_MARKING_ENABLED_KEY in changes ||
        WORD_RECOGNITION_MODE_ENABLED_KEY in changes)
    ) {
      markerContextCache = {
        ...markerContextCache,
        wordMarkingEnabled:
          WORD_MARKING_ENABLED_KEY in changes
            ? changes[WORD_MARKING_ENABLED_KEY].newValue === true
            : markerContextCache.wordMarkingEnabled,
        recognitionModeEnabled:
          WORD_RECOGNITION_MODE_ENABLED_KEY in changes
            ? changes[WORD_RECOGNITION_MODE_ENABLED_KEY].newValue === true
            : markerContextCache.recognitionModeEnabled,
      };
      void rescan();
    }
    if (area === "local") {
      if (
        STUDYING_WORDS_STORAGE_KEY in changes ||
        KNOWN_WORDS_STORAGE_KEY in changes
      ) {
        const changedWords = collectChangedWordKeys(changes);
        markerContextCache = {
          ...markerContextCache,
          knownWords:
            KNOWN_WORDS_STORAGE_KEY in changes
              ? changes[KNOWN_WORDS_STORAGE_KEY].newValue || {}
              : markerContextCache.knownWords,
          studyingWords:
            STUDYING_WORDS_STORAGE_KEY in changes
              ? changes[STUDYING_WORDS_STORAGE_KEY].newValue || {}
              : markerContextCache.studyingWords,
        };
        if (changedWords.length > 0 && changedWords.length <= 50) {
          for (const word of changedWords) {
            updateWordMarkersForWord(document.body, word, markerContextCache);
          }
          hideCard();
          emitRecognitionStats();
        } else {
          void rescan();
        }
      }
    }
  }
  chrome.storage.onChanged.addListener(onStorage);

  return function cleanup() {
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("keydown", onWordMarkerShortcut, true);
    window.removeEventListener("scroll", onScroll);
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.storage.onChanged.removeListener(onStorage);
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (mutationDebounce) {
      clearTimeout(mutationDebounce);
      mutationDebounce = 0;
    }
    rescanVersion += 1;
    unwrapAllMarks();
    hideCard();
    recognitionStatsListener?.(null);
    recognitionStatsListener = null;
  };
}
