/**
 * Chrome 内置 AI 翻译 API 适配
 *
 * 使用浏览器原生 Translator + LanguageDetector，离线运行、免费、无 API Key。
 * 仅 Chrome 138+（含 Edge 同等版本）支持；其他浏览器会返回 unsupported。
 *
 * 关键约束：
 * - LanguageDetector / Translator 模型未下载时，create() 会触发下载并长时间阻塞。
 *   因此默认仅在 availability === "available" 时使用；下载需通过 prepareChromeAiModel 显式触发。
 * - 不使用 translateStreaming：在 MV3 service worker 中流式 API 行为不稳定，
 *   且本地翻译本身够快，单次返回即可。
 * - 缓存 Translator / LanguageDetector 实例，避免每次翻译都重复 create()。
 */
import {
  createAiRequestLog,
  logAiRequestError,
  logAiRequestSuccess,
} from "./ai-request-log.js";

const LANG_TO_CODE = {
  Chinese: "zh",
  English: "en",
  Japanese: "ja",
  Korean: "ko",
  French: "fr",
  German: "de",
  Spanish: "es",
};
const TARGET_LANG_TO_CODE = LANG_TO_CODE;

export function getChromeAiLangCode(lang) {
  if (!lang) return null;
  return LANG_TO_CODE[lang] || String(lang);
}

const ENDPOINT_LABEL = "chrome-ai://translator";
const MODEL_LABEL = "chrome-translator";
const LOG_PREFIX = "[Chrome AI 翻译]";
const TRANSLATE_TIMEOUT_MS = 30000;

// 缓存：同一语言对的 Translator 复用，避免每次翻译都重新 create
const translatorPromiseCache = new Map();
let detectorPromise = null;

export function getChromeAiTargetLangCode(targetLang) {
  return TARGET_LANG_TO_CODE[targetLang] || "zh";
}

function getTranslatorGlobal() {
  return typeof globalThis !== "undefined" && typeof globalThis.Translator !== "undefined"
    ? globalThis.Translator
    : null;
}

function getLanguageDetectorGlobal() {
  return typeof globalThis !== "undefined" && typeof globalThis.LanguageDetector !== "undefined"
    ? globalThis.LanguageDetector
    : null;
}

export function isChromeAiSupported() {
  return !!getTranslatorGlobal();
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} 超时（${Math.round(ms / 1000)}s）`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function safeAvailability(api, args) {
  if (!api || typeof api.availability !== "function") return "unavailable";
  try {
    return args ? await api.availability(args) : await api.availability();
  } catch (_) {
    return "unavailable";
  }
}

function pickFallbackSource(targetCode) {
  return targetCode === "en" ? "zh" : "en";
}

function attachDownloadMonitor(options, onProgress) {
  return {
    ...options,
    monitor(monitor) {
      monitor.addEventListener?.("downloadprogress", (event) => {
        // Chrome 的 downloadprogress 事件通常 loaded 为 0..1，
        // 但部分 API 实现可能用 loaded/total 字节数；都做兼容
        let loaded = Number(event.loaded);
        if (!Number.isFinite(loaded)) loaded = 0;
        if (loaded > 1) {
          const total = Number(event.total);
          if (Number.isFinite(total) && total > 0) {
            loaded = loaded / total;
          } else {
            loaded = 0;
          }
        }
        loaded = Math.max(0, Math.min(1, loaded));
        console.log(
          LOG_PREFIX,
          `downloadprogress 事件: loaded=${event.loaded}, total=${event.total} → ${Math.round(loaded * 100)}%`,
        );
        try {
          onProgress?.(loaded);
        } catch (_) {}
      });
    },
  };
}

async function getOrCreateTranslator(
  sourceCode,
  targetCode,
  { allowDownload = false, onDownloadProgress } = {},
) {
  const key = `${sourceCode}->${targetCode}`;
  const cached = translatorPromiseCache.get(key);
  if (cached) return cached;

  const translator = getTranslatorGlobal();
  if (!translator) {
    throw new Error("当前浏览器不支持 Chrome 内置翻译 API（需 Chrome 138+）。");
  }
  const availability = await safeAvailability(translator, {
    sourceLanguage: sourceCode,
    targetLanguage: targetCode,
  });
  console.log(LOG_PREFIX, `availability ${key}:`, availability);
  if (availability === "unavailable") return null;
  if (availability !== "available" && !allowDownload) return null;

  const baseOptions = { sourceLanguage: sourceCode, targetLanguage: targetCode };
  const finalOptions =
    availability === "available"
      ? baseOptions
      : attachDownloadMonitor(baseOptions, onDownloadProgress);
  const promise = Promise.resolve()
    .then(() => translator.create(finalOptions))
    .catch((error) => {
      translatorPromiseCache.delete(key);
      throw error;
    });
  translatorPromiseCache.set(key, promise);
  return promise;
}

async function getOrCreateDetector() {
  if (detectorPromise) return detectorPromise;
  const detector = getLanguageDetectorGlobal();
  if (!detector) return null;
  const availability = await safeAvailability(detector);
  if (availability !== "available") {
    console.log(LOG_PREFIX, "LanguageDetector 不可用，跳过：", availability);
    return null;
  }
  detectorPromise = Promise.resolve()
    .then(() => detector.create())
    .catch((error) => {
      console.warn(LOG_PREFIX, "LanguageDetector 创建失败：", error);
      detectorPromise = null;
      return null;
    });
  return detectorPromise;
}

async function detectSourceLanguage(text) {
  const instance = await getOrCreateDetector();
  if (!instance) return null;
  try {
    const results = await instance.detect(text);
    if (Array.isArray(results) && results.length > 0) {
      const top = results[0];
      const code = top?.detectedLanguage;
      if (code && code !== "und") return code;
    }
    return null;
  } catch (error) {
    console.warn(LOG_PREFIX, "LanguageDetector 失败：", error);
    return null;
  }
}

async function resolveTranslatorForText(text, targetCode, options = {}) {
  const { onDownloadProgress, explicitSourceCode } = options;

  // 显式指定源语言：直接用，不做自动检测/回退
  if (explicitSourceCode && explicitSourceCode !== targetCode) {
    let instance = await getOrCreateTranslator(explicitSourceCode, targetCode, {
      allowDownload: false,
    });
    if (instance) return { instance, sourceCode: explicitSourceCode };
    instance = await getOrCreateTranslator(explicitSourceCode, targetCode, {
      allowDownload: true,
      onDownloadProgress,
    });
    if (instance) return { instance, sourceCode: explicitSourceCode };
    throw new Error(
      `Chrome 内置翻译当前不支持 ${explicitSourceCode} → ${targetCode}。`,
    );
  }

  const detectedSource = await detectSourceLanguage(text);
  const fallbackSource = pickFallbackSource(targetCode);
  const candidates = [];
  if (detectedSource && detectedSource !== targetCode) candidates.push(detectedSource);
  if (!candidates.includes(fallbackSource)) candidates.push(fallbackSource);
  if (!candidates.includes("en") && targetCode !== "en") candidates.push("en");

  // 第一轮：只用已就绪的 pair
  for (const source of candidates) {
    const instance = await getOrCreateTranslator(source, targetCode, {
      allowDownload: false,
    });
    if (instance) return { instance, sourceCode: source };
  }
  // 第二轮：允许下载
  for (const source of candidates) {
    const instance = await getOrCreateTranslator(source, targetCode, {
      allowDownload: true,
      onDownloadProgress,
    });
    if (instance) return { instance, sourceCode: source };
  }
  throw new Error(
    `Chrome 内置翻译当前不支持目标语言 ${targetCode}（尝试源：${candidates.join(", ")}）。`,
  );
}

async function runTranslateOnce(text, targetLang, options = {}) {
  const { onDownloadProgress, sourceLang } = options;
  const targetCode = getChromeAiLangCode(targetLang);
  const explicitSourceCode = sourceLang ? getChromeAiLangCode(sourceLang) : null;
  const { instance, sourceCode } = await resolveTranslatorForText(text, targetCode, {
    onDownloadProgress,
    explicitSourceCode,
  });
  console.log(LOG_PREFIX, `translate ${sourceCode}→${targetCode}`);
  const translated = await withTimeout(
    Promise.resolve(instance.translate(text)),
    TRANSLATE_TIMEOUT_MS,
    "翻译",
  );
  return String(translated || "").trim();
}

export async function generateChromeAiCompletion(text, targetLang, options = {}) {
  const { onDownloadProgress, sourceLang } = options;
  const trace = createAiRequestLog({
    provider: "chrome-ai",
    endpoint: ENDPOINT_LABEL,
    model: MODEL_LABEL,
    stream: false,
    requestContent: text,
    requestPayload: { targetLang, sourceLang: sourceLang || "auto" },
  });
  try {
    const result = await runTranslateOnce(text, targetLang, {
      onDownloadProgress,
      sourceLang,
    });
    if (!result) {
      throw new Error("Chrome 内置翻译未返回内容。");
    }
    logAiRequestSuccess(trace, { responseContent: result });
    return result;
  } catch (error) {
    logAiRequestError(trace, error);
    throw error;
  }
}

export async function generateChromeAiStreamingCompletion(text, targetLang, options = {}) {
  const { onChunk } = options;
  const onDownloadProgress = (loaded) => {
    onChunk?.({ downloadProgress: loaded });
  };
  const result = await generateChromeAiCompletion(text, targetLang, {
    onDownloadProgress,
  });
  onChunk?.({ response: result, downloadProgress: 1 });
  return { response: result, thinking: "" };
}

/**
 * 显式触发翻译模型下载（en→targetLang）
 * @returns {Promise<{ sourceCode, targetCode, alreadyReady }>}
 */
export async function prepareChromeAiTranslator(targetLang, options = {}) {
  const { onDownloadProgress } = options;
  const translator = getTranslatorGlobal();
  if (!translator) {
    throw new Error("当前浏览器不支持 Chrome 内置翻译 API（需 Chrome 138+）。");
  }
  const targetCode = getChromeAiTargetLangCode(targetLang);
  const sourceCode = pickFallbackSource(targetCode);
  const availability = await safeAvailability(translator, {
    sourceLanguage: sourceCode,
    targetLanguage: targetCode,
  });
  if (availability === "unavailable") {
    throw new Error(`Chrome 内置翻译当前不支持 ${sourceCode} → ${targetCode}。`);
  }
  const alreadyReady = availability === "available";
  const instance = await getOrCreateTranslator(sourceCode, targetCode, {
    allowDownload: true,
    onDownloadProgress,
  });
  if (!instance) {
    throw new Error(`Chrome 内置翻译当前不支持 ${sourceCode} → ${targetCode}。`);
  }
  return { sourceCode, targetCode, alreadyReady };
}

const DETECTOR_DOWNLOAD_TIMEOUT_MS = 120000;
const AVAILABILITY_POLL_INTERVAL_MS = 1500;

function pollUntilAvailable(api, args, { signal, intervalMs = AVAILABILITY_POLL_INTERVAL_MS } = {}) {
  return new Promise((resolve, reject) => {
    let stopped = false;
    const onAbort = () => {
      stopped = true;
      reject(new Error("已取消"));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
    const tick = async () => {
      if (stopped) return;
      try {
        const av = args ? await api.availability(args) : await api.availability();
        if (stopped) return;
        if (av === "available") {
          resolve(av);
          return;
        }
      } catch (_) {}
      if (stopped) return;
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
  });
}

/**
 * 显式触发源语言识别模型下载（可选）
 * @returns {Promise<{ ready, alreadyReady }>}
 */
export async function prepareChromeAiDetector(options = {}) {
  const { onDownloadProgress, signal } = options;
  const detector = getLanguageDetectorGlobal();
  if (!detector) {
    throw new Error("当前浏览器不支持 Chrome 内置语言识别 API。");
  }
  const availability = await safeAvailability(detector);
  console.log(LOG_PREFIX, "LanguageDetector availability:", availability);
  if (availability === "unavailable") {
    throw new Error("当前浏览器不支持源语言识别。");
  }
  const alreadyReady = availability === "available";
  if (alreadyReady) {
    if (!detectorPromise) {
      detectorPromise = Promise.resolve()
        .then(() => detector.create())
        .catch((error) => {
          detectorPromise = null;
          throw error;
        });
    }
    await detectorPromise;
    return { ready: true, alreadyReady: true };
  }
  // downloadable / downloading: 触发下载，并行：
  // 1) await create() 完成
  // 2) 轮询 availability 作为兜底完成信号（部分实现不发 downloadprogress 事件）
  // 3) 超时
  // 4) 用户取消
  const baseOptions = attachDownloadMonitor({}, onDownloadProgress);
  if (!detectorPromise) {
    detectorPromise = Promise.resolve()
      .then(() => detector.create(baseOptions))
      .catch((error) => {
        detectorPromise = null;
        throw error;
      });
  }
  const racePromises = [
    detectorPromise.then(() => "create"),
    pollUntilAvailable(detector, undefined, { signal }).then(() => "poll"),
  ];
  if (signal) {
    racePromises.push(
      new Promise((_, reject) => {
        if (signal.aborted) return reject(new Error("已取消"));
        signal.addEventListener("abort", () => reject(new Error("已取消")), {
          once: true,
        });
      }),
    );
  }
  try {
    await withTimeout(
      Promise.race(racePromises),
      DETECTOR_DOWNLOAD_TIMEOUT_MS,
      "源语言识别模型下载",
    );
  } catch (error) {
    if (error?.message === "已取消") throw error;
    const finalAv = await safeAvailability(detector);
    if (finalAv === "available") {
      return { ready: true, alreadyReady: false };
    }
    throw new Error(
      `源语言识别模型未能下载（${error.message}）。可能需要在 chrome://flags 启用 #language-detection-api，或当前 Chrome 版本暂不支持此模型。`,
    );
  }
  // 确认是否就绪
  const finalAv = await safeAvailability(detector);
  if (finalAv !== "available") {
    throw new Error("下载完成，但模型未进入 available 状态。请稍后重试。");
  }
  return { ready: true, alreadyReady: false };
}

/**
 * 详细可用性查询（不触发下载）
 */
export async function checkChromeAiAvailability(targetLang) {
  const translator = getTranslatorGlobal();
  if (!translator) {
    return {
      supported: false,
      translator: "unsupported",
      detector: "unsupported",
    };
  }
  const targetCode = getChromeAiTargetLangCode(targetLang);
  const sourceCode = pickFallbackSource(targetCode);
  const translatorAv = await safeAvailability(translator, {
    sourceLanguage: sourceCode,
    targetLanguage: targetCode,
  });
  const detector = getLanguageDetectorGlobal();
  const detectorAv = detector ? await safeAvailability(detector) : "unsupported";
  return {
    supported: true,
    translator: translatorAv,
    detector: detectorAv,
    sourceCode,
    targetCode,
  };
}

/**
 * 探测所有已下载（available）的语言对
 * @returns {Promise<Array<{source: string, target: string}>>}
 */
export async function probeChromeAiAvailablePairs() {
  const translator = getTranslatorGlobal();
  if (!translator) return [];
  const codes = Object.values(LANG_TO_CODE);
  const tasks = [];
  for (const source of codes) {
    for (const target of codes) {
      if (source === target) continue;
      tasks.push(
        safeAvailability(translator, {
          sourceLanguage: source,
          targetLanguage: target,
        }).then((status) => ({ source, target, status })),
      );
    }
  }
  const results = await Promise.all(tasks);
  return results
    .filter((item) => item.status === "available")
    .map(({ source, target }) => ({ source, target }));
}

export async function testChromeAiConnection(targetLang = "Chinese") {
  const status = await checkChromeAiAvailability(targetLang);
  if (!status.supported) {
    throw new Error("当前浏览器不支持 Chrome 内置翻译 API（需 Chrome 138+）。");
  }
  if (status.translator === "unavailable") {
    throw new Error(
      `Chrome 内置翻译当前不支持 ${status.sourceCode} → ${status.targetCode}。`,
    );
  }
  return status.translator;
}
