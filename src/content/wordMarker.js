/**
 * 英语生词标记 - content 端
 *
 * 功能：
 *  - 加载 studyingWords，对其中"当前可见"（已过 nextReviewAt）的词
 *    在文本节点中用 <span class="ai-tr-word"> 包裹，显示虚下划线。
 *  - 鼠标悬停 + 短停留 → 弹出小卡片：音标、发音按钮、记得/忘记/我知道按钮。
 *  - 监听 wordsChanged / 设置开关变化，做增量重渲染（简单粗暴：移除并重扫）。
 */
import {
  STUDYING_WORDS_STORAGE_KEY,
  KNOWN_WORDS_STORAGE_KEY,
  WORD_MARKING_ENABLED_KEY,
  isStudyingVisibleNow,
  normalizeWord,
} from "../shared/word-learning.js";
import { buildYoudaoAudioUrl } from "../shared/youdao-api.js";

const WORD_SPAN_CLASS = "ai-tr-word";
const WORD_STYLE_TAG_ID = "__ai_translate_word_marker_style__";
const CARD_ID = "__ai_translate_word_card__";
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

const WORD_REGEX = /[A-Za-z][A-Za-z'\-]{1,30}/g;

function ensureWordStyles() {
  if (document.getElementById(WORD_STYLE_TAG_ID)) return;
  const style = document.createElement("style");
  style.id = WORD_STYLE_TAG_ID;
  style.textContent = `
    .${WORD_SPAN_CLASS}{
      border-bottom:1px dashed #f59e0b;
      cursor:help;
    }
    #${CARD_ID}{
      position:absolute; z-index:2147483645;
      background:#1a1a1f; color:#fafafa;
      border:1px solid #2a2a30; border-radius:10px;
      padding:10px 12px; min-width:200px; max-width:300px;
      box-shadow:0 12px 32px rgba(0,0,0,0.45);
      font:13px -apple-system,"Segoe UI",sans-serif;
      line-height:1.45;
    }
    #${CARD_ID} .ai-tr-card-word{font-size:15px;font-weight:600;margin-bottom:4px;color:#fff}
    #${CARD_ID} .ai-tr-card-phon{color:#a1a1aa;font-size:12px;margin-bottom:6px;display:flex;gap:10px;flex-wrap:wrap}
    #${CARD_ID} .ai-tr-card-phon button{background:transparent;border:0;color:#8ab4f8;cursor:pointer;padding:0;font:inherit}
    #${CARD_ID} .ai-tr-card-tr{color:#d4d4d8;font-size:12px;margin-bottom:8px;max-height:96px;overflow:auto}
    #${CARD_ID} .ai-tr-card-actions{display:flex;gap:6px;flex-wrap:wrap}
    #${CARD_ID} .ai-tr-card-actions button{flex:1 1 auto;border:1px solid #27272a;background:#222228;color:#fafafa;border-radius:6px;padding:5px 8px;font:inherit;cursor:pointer;font-size:12px}
    #${CARD_ID} .ai-tr-card-actions button.primary{background:linear-gradient(135deg,#22c55e,#16a34a);border-color:transparent}
    #${CARD_ID} .ai-tr-card-actions button.warn{background:#3a2a2a;border-color:#5a2a2a;color:#fca5a5}
    #${CARD_ID} .ai-tr-card-actions button.known{background:#1f3a2a;border-color:#22c55e44;color:#86efac}
    @media (prefers-color-scheme: light){
      #${CARD_ID}{background:#fff;color:#111;border-color:#d6dce8;box-shadow:0 12px 32px rgba(15,23,42,.18)}
      #${CARD_ID} .ai-tr-card-word{color:#111}
      #${CARD_ID} .ai-tr-card-phon{color:#475569}
      #${CARD_ID} .ai-tr-card-tr{color:#1f2937}
      #${CARD_ID} .ai-tr-card-actions button{background:#f1f5f9;border-color:#cbd5e1;color:#0f172a}
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function shouldSkipNode(node) {
  if (!node || !node.parentNode) return true;
  let p = node.parentNode;
  while (p && p.nodeType === 1) {
    if (SKIP_TAGS.has(p.tagName)) return true;
    if (p.isContentEditable) return true;
    if (p.classList?.contains(WORD_SPAN_CLASS)) return true;
    if (p.id === CARD_ID) return true;
    if (p.id === "__ai_translate_ui_rewrite_overlay__") return true;
    if (p.closest?.("#ollama-pt-bar, #ollama-translate-tip, #ollama-translate-button"))
      return true;
    p = p.parentNode;
  }
  return false;
}

function collectVisibleWords(studyingMap) {
  const set = new Set();
  const now = Date.now();
  for (const [word, entry] of Object.entries(studyingMap || {})) {
    if (isStudyingVisibleNow(entry, now)) set.add(word.toLowerCase());
  }
  return set;
}

function unwrapAllMarks(root = document.body) {
  if (!root) return;
  const nodes = root.querySelectorAll(`.${WORD_SPAN_CLASS}`);
  nodes.forEach((node) => {
    const text = document.createTextNode(node.textContent || "");
    node.replaceWith(text);
  });
}

function markTextNode(node, visibleWords) {
  const text = node.nodeValue;
  if (!text || text.length < 2) return;
  WORD_REGEX.lastIndex = 0;
  let match;
  let lastIndex = 0;
  let frag = null;
  while ((match = WORD_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const lower = raw.toLowerCase();
    if (!visibleWords.has(lower)) continue;
    if (!frag) frag = document.createDocumentFragment();
    if (match.index > lastIndex) {
      frag.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
    }
    const span = document.createElement("span");
    span.className = WORD_SPAN_CLASS;
    span.dataset.word = lower;
    span.textContent = raw;
    frag.appendChild(span);
    lastIndex = match.index + raw.length;
  }
  if (frag) {
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

function scanAndMark(root, visibleWords) {
  if (!root || visibleWords.size === 0) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || node.nodeValue.length < 2) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) markTextNode(node, visibleWords);
}

let cardEl = null;
let cardWord = "";

function hideCard() {
  if (cardEl) {
    cardEl.remove();
    cardEl = null;
    cardWord = "";
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

function playAudio(word, type) {
  try {
    const audio = new Audio(buildYoudaoAudioUrl(word, type));
    audio.crossOrigin = "anonymous";
    audio.play().catch(() => {});
  } catch (_) {}
}

function positionCard(card, anchor) {
  const rect = anchor.getBoundingClientRect();
  const top = window.scrollY + rect.bottom + 6;
  const left = window.scrollX + Math.max(8, rect.left);
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function buildCardHtml(word) {
  return `
    <div class="ai-tr-card-word">${escapeHtml(word)}</div>
    <div class="ai-tr-card-phon" data-role="phon">加载中…</div>
    <div class="ai-tr-card-tr" data-role="tr"></div>
    <div class="ai-tr-card-actions">
      <button data-act="forget" class="warn" title="点击后 1h 内仍标记">忘记</button>
      <button data-act="remember" class="primary" title="点击后按记忆梯度延后">记得</button>
      <button data-act="known" class="known" title="加入「我知道的单词」">我会</button>
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

async function showCardFor(span, word) {
  ensureWordStyles();
  if (cardEl && cardWord === word) {
    positionCard(cardEl, span);
    return;
  }
  hideCard();
  const card = document.createElement("div");
  card.id = CARD_ID;
  card.innerHTML = buildCardHtml(word);
  document.body.appendChild(card);
  cardEl = card;
  cardWord = word;
  positionCard(card, span);

  card.addEventListener("mouseleave", scheduleHide);
  card.addEventListener("mouseenter", cancelHide);

  card.addEventListener("click", async (event) => {
    const act = event.target?.dataset?.act;
    if (!act) return;
    if (act === "remember") {
      await sendBg({ action: "reviewWord", word, reviewAction: "remember" });
      hideCard();
    } else if (act === "forget") {
      await sendBg({ action: "reviewWord", word, reviewAction: "forget" });
      hideCard();
    } else if (act === "known") {
      await sendBg({ action: "addKnownWord", word });
      hideCard();
    } else if (act === "play-uk") {
      playAudio(word, 1);
    } else if (act === "play-us") {
      playAudio(word, 2);
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
  cancelHide();
  if (hoverTimer) clearTimeout(hoverTimer);
  const word = span.dataset.word || normalizeWord(span.textContent || "");
  if (!word) return;
  hoverTimer = window.setTimeout(() => {
    void showCardFor(span, word);
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
let visibleWordsCache = new Set();
let enabled = false;

function ensureMutationObserver() {
  if (mutationObserver) return;
  mutationObserver = new MutationObserver((mutations) => {
    if (!enabled || visibleWordsCache.size === 0) return;
    const roots = new Set();
    for (const m of mutations) {
      for (const node of m.addedNodes || []) {
        if (node.nodeType === 1 && !shouldSkipNode(node.firstChild || node)) {
          roots.add(node);
        }
      }
    }
    if (roots.size === 0) return;
    if (mutationDebounce) clearTimeout(mutationDebounce);
    mutationDebounce = window.setTimeout(() => {
      for (const root of roots) scanAndMark(root, visibleWordsCache);
    }, 250);
  });
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
  });
}

async function rescan() {
  if (!enabled) {
    unwrapAllMarks();
    hideCard();
    return;
  }
  ensureWordStyles();
  unwrapAllMarks();
  const res = await sendBg({ action: "getStudyingWords" });
  visibleWordsCache = collectVisibleWords(res?.words || {});
  if (visibleWordsCache.size === 0) return;
  scanAndMark(document.body, visibleWordsCache);
  ensureMutationObserver();
}

async function readEnabled() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([WORD_MARKING_ENABLED_KEY], (v) => {
      resolve(v?.[WORD_MARKING_ENABLED_KEY] === true);
    });
  });
}

export function initWordMarker() {
  ensureWordStyles();

  void (async () => {
    enabled = await readEnabled();
    if (enabled) await rescan();
  })();

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  window.addEventListener("scroll", onScroll, { passive: true });

  function onMessage(msg) {
    if (!msg) return;
    if (msg.action === "wordsChanged") {
      void rescan();
    } else if (msg.action === "wordMarkingEnabledChanged") {
      enabled = !!msg.enabled;
      void rescan();
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);

  function onStorage(changes, area) {
    if (area === "sync" && WORD_MARKING_ENABLED_KEY in changes) {
      enabled = changes[WORD_MARKING_ENABLED_KEY].newValue === true;
      void rescan();
    }
    if (area === "local") {
      if (
        STUDYING_WORDS_STORAGE_KEY in changes ||
        KNOWN_WORDS_STORAGE_KEY in changes
      ) {
        void rescan();
      }
    }
  }
  chrome.storage.onChanged.addListener(onStorage);

  return function cleanup() {
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    window.removeEventListener("scroll", onScroll);
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.storage.onChanged.removeListener(onStorage);
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    unwrapAllMarks();
    hideCard();
  };
}
