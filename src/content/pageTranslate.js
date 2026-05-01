const IGNORE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS",
  "KBD",
  "SAMP",
  "VAR",
]);
const IGNORE_ANCESTOR_SELECTOR =
  "script,style,noscript,textarea,input,select,option,code,pre,svg,canvas,kbd,samp,var";

const SIGNIFICANT_CHAR_RE = /[\p{L}\p{N}\u3400-\u9fff]/u;
const PAGE_TRANSLATE_SCAN_DEBOUNCE_MS = 180;
const PAGE_TRANSLATE_MAX_QUEUE_SIZE = 80;
const PAGE_TRANSLATE_MAX_SCAN_NODES = 1200;
const PAGE_TRANSLATE_DEFAULT_CONCURRENT = 1;
const PAGE_TRANSLATE_DEFAULT_BATCH_CHARS = 128;
const PAGE_TRANSLATE_MAX_ITEMS_PER_BATCH = 32;
const PAGE_TRANSLATE_MAX_CACHE_SIZE = 300;
const PAGE_TRANSLATE_PENDING_CLASS = "ollama-page-translate-pending";
const PAGE_TRANSLATE_WRAP_CLASS = "ollama-pt-wrap";
const PAGE_TRANSLATE_ORIG_CLASS = "ollama-pt-orig";
const PAGE_TRANSLATE_TRANS_CLASS = "ollama-pt-trans";
const DISPLAY_MODE_CLASS_PREFIX = "ollama-pt-mode-";
export const PAGE_TRANSLATE_DISPLAY_MODES = ["translation", "original", "bilingual"];
const DEFAULT_DISPLAY_MODE = "translation";

function applyDisplayModeClass(mode) {
  const root = document.documentElement;
  if (!root) return;
  PAGE_TRANSLATE_DISPLAY_MODES.forEach((m) => {
    root.classList.remove(`${DISPLAY_MODE_CLASS_PREFIX}${m}`);
  });
  root.classList.add(`${DISPLAY_MODE_CLASS_PREFIX}${mode}`);
}

function clearDisplayModeClass() {
  const root = document.documentElement;
  if (!root) return;
  PAGE_TRANSLATE_DISPLAY_MODES.forEach((m) => {
    root.classList.remove(`${DISPLAY_MODE_CLASS_PREFIX}${m}`);
  });
}
const PAGE_TRANSLATE_RETRY_DELAY_MS = 8000;
const PAGE_TRANSLATE_RETRY_DELAY_RATE_LIMIT_MS = 60000;
const THINK_TAG_RE = /<\/?think\b[^>]*>/i;
const RATE_LIMIT_ERROR_RE =
  /(?:\b429\b|rate[ -]?limit|too many requests|usage limit|quota)/i;
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

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRenderableRect(rect) {
  return !!rect && rect.width >= 1 && rect.height >= 1;
}

function rectIntersectsViewport(rect) {
  if (!hasRenderableRect(rect)) return false;
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function isElementRenderable(element) {
  if (!element || !(element instanceof HTMLElement)) return false;
  let current = element;
  while (current && current instanceof HTMLElement) {
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) <= 0.01 ||
      current.hidden ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    current = current.parentElement;
  }

  return hasRenderableRect(element.getBoundingClientRect());
}

function isElementInViewport(element) {
  if (!element || !(element instanceof HTMLElement)) return false;
  return rectIntersectsViewport(element.getBoundingClientRect());
}

function computeOffscreenDistance(rect) {
  if (!rect) return Number.MAX_SAFE_INTEGER;
  if (rect.bottom <= 0) {
    // 已滚过去的内容排在后面，优先处理当前屏幕之后的内容
    return window.innerHeight + Math.abs(rect.bottom);
  }
  return Math.max(0, rect.top - window.innerHeight);
}

function isEditable(element) {
  return !!(
    element &&
    element.closest &&
    element.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  );
}

function isInteractive(element) {
  return !!(
    element &&
    element.closest &&
    element.closest(INTERACTIVE_SELECTOR)
  );
}

function makeCacheWriter(cacheMap) {
  return function writeCache(key, value) {
    if (!key || !value) return;
    if (cacheMap.has(key)) {
      cacheMap.set(key, value);
      return;
    }
    if (cacheMap.size >= PAGE_TRANSLATE_MAX_CACHE_SIZE) {
      const oldestKey = cacheMap.keys().next().value;
      if (oldestKey) cacheMap.delete(oldestKey);
    }
    cacheMap.set(key, value);
  };
}

function normalizePositiveInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isRateLimitedError(value) {
  return RATE_LIMIT_ERROR_RE.test(String(value || ""));
}

function computeNodePriority(text, rect) {
  const lengthScore = Math.min(String(text || "").length, 240);
  const wordScore = Math.min(String(text || "").split(/\s+/).length * 8, 120);
  const centerY = window.innerHeight * 0.45;
  const rectCenterY = rect ? (rect.top + rect.bottom) / 2 : centerY;
  const centerBias = Math.max(0, 120 - Math.abs(rectCenterY - centerY));
  return lengthScore + wordScore + centerBias;
}

export function createVisualPageTranslator({
  requestChunkTranslation,
  requestBatchTranslation,
  onStatusMessage,
  shouldSkipText,
  isUiElement,
  initialOptions = {},
}) {
  const translatedNodes = new WeakSet();
  const pendingNodes = new WeakSet();
  const pendingParentCount = new Map();
  const failedNodeRetryAt = new WeakMap();
  const translationCache = new Map();
  const writeCache = makeCacheWriter(translationCache);
  const queue = [];

  let active = false;
  let inFlightCount = 0;
  let scanTimerId = null;
  let mutationObserver = null;
  let displayMode = DEFAULT_DISPLAY_MODE;
  let displayModeListeners = new Set();
  let maxConcurrent = normalizePositiveInt(
    initialOptions.maxConcurrent,
    1,
    8,
    PAGE_TRANSLATE_DEFAULT_CONCURRENT,
  );
  let batchChars = normalizePositiveInt(
    initialOptions.batchChars,
    32,
    2048,
    PAGE_TRANSLATE_DEFAULT_BATCH_CHARS,
  );
  let hasShownRateLimitMessage = false;

  function clearScanTimer() {
    if (scanTimerId !== null) {
      clearTimeout(scanTimerId);
      scanTimerId = null;
    }
  }

  function disconnectMutationObserver() {
    if (!mutationObserver) return;
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  function ensureMutationObserver() {
    if (mutationObserver || !document.body) return;
    mutationObserver = new MutationObserver((mutations) => {
      if (!active) return;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          if (mutation.addedNodes?.length) {
            scheduleScan(false);
            return;
          }
        } else if (mutation.type === "characterData") {
          scheduleScan(false);
          return;
        }
      }
    });

    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  function isNodeEligible(node, options = {}) {
    const { allowOffscreen = false } = options;
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    if (translatedNodes.has(node) || pendingNodes.has(node)) return false;
    const retryAt = failedNodeRetryAt.get(node) || 0;
    if (retryAt > Date.now()) return false;
    if (IGNORE_TAGS.has(parent.tagName)) return false;
    // 任意祖先在忽略列表（如 <pre>、<code>）中也跳过，避免代码块被翻译
    if (parent.closest && parent.closest(IGNORE_ANCESTOR_SELECTOR)) {
      return false;
    }
    // 已翻译并被包裹的节点（含其内部 orig/trans 文本）不再二次处理
    if (parent.closest && parent.closest(`.${PAGE_TRANSLATE_WRAP_CLASS}`)) {
      return false;
    }
    if (isEditable(parent)) return false;
    if (isInteractive(parent)) return false;
    if (typeof isUiElement === "function" && isUiElement(parent)) return false;
    if (!isElementRenderable(parent)) return false;
    if (!allowOffscreen && !isElementInViewport(parent)) return false;

    const text = normalizeText(node.textContent);
    if (!text || text.length < 2) return false;
    if (!SIGNIFICANT_CHAR_RE.test(text)) return false;
    if (typeof shouldSkipText === "function" && shouldSkipText(text)) {
      return false;
    }

    return true;
  }

  function setParentPendingState(parent, isPending) {
    if (!parent) return;

    const currentCount = pendingParentCount.get(parent) || 0;
    if (isPending) {
      const nextCount = currentCount + 1;
      pendingParentCount.set(parent, nextCount);
      if (currentCount === 0) {
        parent.classList.add(PAGE_TRANSLATE_PENDING_CLASS);
      }
      return;
    }

    if (currentCount <= 1) {
      pendingParentCount.delete(parent);
      parent.classList.remove(PAGE_TRANSLATE_PENDING_CLASS);
      return;
    }
    pendingParentCount.set(parent, currentCount - 1);
  }

  function setNodePendingState(node, isPending) {
    setParentPendingState(node?.parentElement, isPending);
  }

  function collectCandidateTextNodes() {
    const root = document.body;
    if (!root) return [];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isNodeEligible(node, { allowOffscreen: true })
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const visibleNodes = [];
    const offscreenNodes = [];
    let visibleChars = 0;
    let current = walker.nextNode();

    while (current) {
      const text = normalizeText(current.textContent);
      if (!text) {
        translatedNodes.add(current);
      } else {
        const parent = current.parentElement;
        const rect = parent?.getBoundingClientRect?.() || null;
        const item = {
          node: current,
          text,
          top: rect?.top ?? 0,
          priority: computeNodePriority(text, rect),
          distance: computeOffscreenDistance(rect),
        };

        if (isElementInViewport(parent)) {
          visibleNodes.push(item);
          visibleChars += text.length;
        } else {
          offscreenNodes.push(item);
        }
      }

      if (visibleNodes.length + offscreenNodes.length >= PAGE_TRANSLATE_MAX_SCAN_NODES) {
        break;
      }
      current = walker.nextNode();
    }

    visibleNodes.sort((a, b) => b.priority - a.priority || a.top - b.top);
    offscreenNodes.sort((a, b) => a.distance - b.distance || a.top - b.top);

    // 优先当前屏幕；如果当前屏内容不足一批，则自动继续收集屏幕外内容凑满 batchChars
    const nodes = [...visibleNodes];
    let totalChars = visibleChars;
    for (const item of offscreenNodes) {
      if (nodes.length >= PAGE_TRANSLATE_MAX_SCAN_NODES) break;
      if (totalChars >= batchChars && visibleNodes.length > 0) break;
      nodes.push(item);
      totalChars += item.text.length;
    }

    return nodes;
  }

  async function processQueueBatch(tasks) {
    const translations = new Array(tasks.length).fill("");
    const successFlags = new Array(tasks.length).fill(false);
    const unresolved = [];

    tasks.forEach((task, index) => {
      if (!task?.node?.isConnected) return;
      const cached = translationCache.get(task.text);
      if (cached) {
        translations[index] = cached;
        return;
      }
      unresolved.push({ index, task });
    });

    if (unresolved.length > 0) {
      let resolvedBatchTranslations = [];
      const shouldUseBatch =
        typeof requestBatchTranslation === "function" && unresolved.length > 1;

      if (shouldUseBatch) {
        const response = await requestBatchTranslation(
          unresolved.map((item) => item.task.text),
        );
        if (!response?.ok && isRateLimitedError(response?.error)) {
          const rateLimitError = new Error(response.error || "rate_limited");
          rateLimitError.code = "RATE_LIMIT";
          throw rateLimitError;
        }
        if (
          response?.ok &&
          Array.isArray(response.translations) &&
          response.translations.length === unresolved.length
        ) {
          resolvedBatchTranslations = response.translations.map((item) =>
            normalizeText(item),
          );
        }
      }

      if (resolvedBatchTranslations.length !== unresolved.length) {
        if (shouldUseBatch) {
          // 批量失败时不再退化为逐条请求，避免请求风暴与额度瞬时耗尽
          resolvedBatchTranslations = new Array(unresolved.length).fill("");
        } else {
          resolvedBatchTranslations = [];
          for (const item of unresolved) {
            const response = await requestChunkTranslation(item.task.text);
            if (!response?.ok && isRateLimitedError(response?.error)) {
              const rateLimitError = new Error(
                response.error || "rate_limited",
              );
              rateLimitError.code = "RATE_LIMIT";
              throw rateLimitError;
            }
            const translated = response?.ok
              ? normalizeText(response.translation || "")
              : "";
            resolvedBatchTranslations.push(translated);
          }
        }
      }

      unresolved.forEach((item, idx) => {
        const translated = resolvedBatchTranslations[idx] || "";
        if (!translated) return;
        translations[item.index] = translated;
        writeCache(item.task.text, translated);
      });
    }

    tasks.forEach((task, index) => {
      const translated = translations[index];
      if (!translated || !task?.node?.isConnected) return;
      if (THINK_TAG_RE.test(translated)) return;
      const currentText = normalizeText(task.node.textContent);
      if (!currentText || currentText !== task.text) return;
      const replaced = wrapTextNode(task.node, task.text, translated);
      if (replaced) successFlags[index] = true;
    });

    return successFlags;
  }

  function wrapTextNode(textNode, originalText, translatedText) {
    const parent = textNode.parentNode;
    if (!parent) return false;
    const rawOriginal = textNode.textContent || "";
    // 保留原文的前后空白：翻译器返回值会被 trim，相邻文本节点直接拼接会丢空格
    const leading = rawOriginal.match(/^\s*/)?.[0] || "";
    const trailing = rawOriginal.match(/\s*$/)?.[0] || "";

    const wrap = document.createElement("span");
    wrap.className = PAGE_TRANSLATE_WRAP_CLASS;
    const origSpan = document.createElement("span");
    origSpan.className = PAGE_TRANSLATE_ORIG_CLASS;
    origSpan.textContent = rawOriginal;
    const transSpan = document.createElement("span");
    transSpan.className = PAGE_TRANSLATE_TRANS_CLASS;
    transSpan.textContent = `${leading}${translatedText}${trailing}`;
    wrap.appendChild(origSpan);
    wrap.appendChild(transSpan);
    try {
      parent.replaceChild(wrap, textNode);
    } catch (_) {
      return false;
    }
    return true;
  }

  function scheduleScan(immediate = false) {
    if (!active) return;
    clearScanTimer();
    if (immediate) {
      scanVisibleAndPump();
      return;
    }
    scanTimerId = window.setTimeout(() => {
      scanTimerId = null;
      scanVisibleAndPump();
    }, PAGE_TRANSLATE_SCAN_DEBOUNCE_MS);
  }

  function scanVisibleAndPump() {
    if (!active) return;

    const candidateNodes = collectCandidateTextNodes();
    for (const item of candidateNodes) {
      if (queue.length >= PAGE_TRANSLATE_MAX_QUEUE_SIZE) break;
      const { node, text } = item;
      const parent = node.parentElement;
      pendingNodes.add(node);
      setParentPendingState(parent, true);
      queue.push({ node, text, parent });
    }

    pumpQueue();
  }

  function pumpQueue() {
    if (!active) return;

    while (inFlightCount < maxConcurrent && queue.length > 0) {
      let totalChars = 0;
      let takeCount = 0;
      while (
        takeCount < queue.length &&
        takeCount < PAGE_TRANSLATE_MAX_ITEMS_PER_BATCH &&
        (takeCount === 0 || totalChars < batchChars)
      ) {
        totalChars += queue[takeCount].text.length;
        takeCount += 1;
      }
      const tasks = queue.splice(0, takeCount);
      inFlightCount += 1;
      void processQueueBatch(tasks)
        .then((successFlags = []) => {
          tasks.forEach((task, index) => {
            setParentPendingState(task.parent, false);
            pendingNodes.delete(task.node);
            if (successFlags[index]) {
              translatedNodes.add(task.node);
              failedNodeRetryAt.delete(task.node);
            } else if (task?.node?.isConnected) {
              failedNodeRetryAt.set(
                task.node,
                Date.now() + PAGE_TRANSLATE_RETRY_DELAY_MS,
              );
            }
          });
        })
        .catch((error) => {
          const rateLimited =
            error?.code === "RATE_LIMIT" ||
            isRateLimitedError(error?.message) ||
            isRateLimitedError(error);
          tasks.forEach((task) => {
            setParentPendingState(task.parent, false);
            pendingNodes.delete(task.node);
            if (task?.node?.isConnected) {
              failedNodeRetryAt.set(
                task.node,
                Date.now() +
                  (rateLimited
                    ? PAGE_TRANSLATE_RETRY_DELAY_RATE_LIMIT_MS
                    : PAGE_TRANSLATE_RETRY_DELAY_MS),
              );
            }
          });
          if (rateLimited) {
            queue.length = 0;
            if (
              !hasShownRateLimitMessage &&
              typeof onStatusMessage === "function"
            ) {
              hasShownRateLimitMessage = true;
              onStatusMessage("翻译额度不足/触发限流，已暂停页面翻译。");
            }
            stop();
          }
        })
        .finally(() => {
          inFlightCount -= 1;
          if (active && queue.length > 0) {
            pumpQueue();
            return;
          }
          if (active && queue.length === 0 && inFlightCount === 0) {
            // 当前批次完成后再次扫描，继续处理同一屏剩余节点
            scheduleScan(false);
          }
        });
    }
  }

  function start() {
    hasShownRateLimitMessage = false;
    if (!active) {
      active = true;
      applyDisplayModeClass(displayMode);
      ensureMutationObserver();
      if (typeof onStatusMessage === "function") {
        onStatusMessage("已开始页面翻译：优先当前可视区域，并自动继续凑满每批字符数。");
      }
    } else if (typeof onStatusMessage === "function") {
      onStatusMessage("继续页面翻译，并自动向后收集页面内容。");
    }

    scheduleScan(true);
  }

  function setDisplayMode(mode) {
    if (!PAGE_TRANSLATE_DISPLAY_MODES.includes(mode)) return;
    displayMode = mode;
    applyDisplayModeClass(mode);
    displayModeListeners.forEach((fn) => {
      try {
        fn(mode);
      } catch (_) {}
    });
  }

  function getDisplayMode() {
    return displayMode;
  }

  function onDisplayModeChange(fn) {
    if (typeof fn !== "function") return () => {};
    displayModeListeners.add(fn);
    return () => displayModeListeners.delete(fn);
  }

  function handleViewportChanged() {
    if (!active) return;
    scheduleScan(false);
  }

  function stop() {
    active = false;
    clearScanTimer();
    disconnectMutationObserver();
    for (const task of queue) {
      if (!task?.node) continue;
      setParentPendingState(task.parent, false);
      pendingNodes.delete(task.node);
    }
    queue.length = 0;
    for (const element of pendingParentCount.keys()) {
      element.classList.remove(PAGE_TRANSLATE_PENDING_CLASS);
    }
    pendingParentCount.clear();
  }

  function updateOptions(nextOptions = {}) {
    maxConcurrent = normalizePositiveInt(
      nextOptions.maxConcurrent,
      1,
      8,
      maxConcurrent,
    );
    batchChars = normalizePositiveInt(
      nextOptions.batchChars,
      32,
      2048,
      batchChars,
    );
    if (active) {
      pumpQueue();
    }
  }

  return {
    start,
    stop,
    handleViewportChanged,
    updateOptions,
    setDisplayMode,
    getDisplayMode,
    onDisplayModeChange,
    isActive() {
      return active;
    },
  };
}
