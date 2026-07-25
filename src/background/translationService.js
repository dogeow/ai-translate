import { checkOllamaAndGetModels } from "./ollama.js";
import {
  analyzeSentenceStudy,
  hydrateSentenceStudyTranslations,
} from "./sentenceStudy.js";
import {
  normalizeRuntimeSettings,
  resolveProviderRuntime,
  buildMissingCredentialError,
} from "./translationSettings.js";
import { migrateSettingsIfNeeded } from "../shared/settings.js";
import {
  runProviderCompletion,
  runProviderStreaming,
  toProviderError,
} from "./translationProviders.js";
import { PROVIDER_OLLAMA } from "../shared/constants.js";
import { filterTranslationModels } from "../shared/model-utils.js";
import { generateChromeAiCompletion } from "../shared/chrome-ai-api.js";
import {
  normalizeDisplayText,
  splitThinkingFromText,
  mergeThinking,
  buildTranslatePrompt,
  buildPageBatchTranslatePrompt,
  parsePageBatchTranslations,
  isRateLimitError,
} from "../shared/utils/textProcessing.js";
import {
  sendTranslatePending,
  sendTranslateResult,
  buildPendingTranslatePayload,
  persistTranslateResult,
  createTranslateRequestId,
  buildErrorResult,
} from "../shared/utils/messaging.js";
import { appendTranslationCache } from "../shared/translation-cache.js";
import { resolveTranslationTargetLang } from "../shared/translation-language.js";

const MIN_THINK_PREVIEW_MS = 320;
const latestTranslateRequestIdsByTab = new Map();

function registerLatestTranslateRequest(tabId, requestId) {
  if (!tabId || !requestId) return;
  latestTranslateRequestIdsByTab.set(tabId, requestId);
}

function isLatestTranslateRequest(tabId, requestId) {
  if (!tabId || !requestId) return true;
  return latestTranslateRequestIdsByTab.get(tabId) === requestId;
}

async function buildNoModelResult(settings, text, providerRuntime, options) {
  const {
    requestId,
    triggerSource,
    learningModeEnabled,
    persistResult = true,
  } = options;
  const check = await checkOllamaAndGetModels(settings.ollamaUrl);
  const errorResult = buildErrorResult({
    original: text,
    targetLang: providerRuntime.targetLang,
    error: check.error ? (check.error === "403" ? "403" : "connection") : "no_model",
    models: check.models,
    needModel: true,
    learningModeEnabled,
    requestId,
    triggerSource,
  });
  if (persistResult) {
    await persistTranslateResult(errorResult);
  }
  return errorResult;
}

function buildCredentialErrorResult(text, providerRuntime, credentialError, options) {
  const {
    requestId,
    triggerSource,
    learningModeEnabled,
  } = options;
  return buildErrorResult({
    original: text,
    targetLang: providerRuntime.targetLang,
    error: credentialError,
    model: providerRuntime.selectedModel || null,
    needModel: false,
    learningModeEnabled,
    requestId,
    triggerSource,
  });
}

export async function translatePageBatchWithProvider(texts, options = {}) {
  const { settings: storedSettings } = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  const settings = normalizeRuntimeSettings(storedSettings);
  const MAX_TEXTS_PER_BATCH = 32;
  const normalizedTexts = Array.isArray(texts)
    ? texts
        .map((text) => String(text || "").trim())
        .filter(Boolean)
        .slice(0, MAX_TEXTS_PER_BATCH)
    : [];
  if (normalizedTexts.length === 0) {
    return { ok: false, error: "empty_texts" };
  }
  if (!settings.appEnabled) {
    return { ok: false, disabled: true };
  }

  const baseProviderRuntime = resolveProviderRuntime(settings);
  const providerRuntime = {
    ...baseProviderRuntime,
    targetLang: resolveTranslationTargetLang(
      normalizedTexts.join("\n"),
      baseProviderRuntime.targetLang,
    ),
  };
  if (
    providerRuntime.provider === PROVIDER_OLLAMA &&
    !providerRuntime.selectedModel
  ) {
    const check = await checkOllamaAndGetModels(settings.ollamaUrl);
    return {
      ok: false,
      needModel: true,
      models: filterTranslationModels(check.models || []),
      error: check.error ? (check.error === "403" ? "403" : "connection") : "no_model",
    };
  }

  const credentialError = buildMissingCredentialError(providerRuntime, settings);
  if (credentialError) {
    return { ok: false, needModel: false, error: credentialError };
  }

  if (providerRuntime.isChromeAi) {
    const { onDownloadProgress } = options;
    const settled = await Promise.all(
      normalizedTexts.map((entry) =>
        generateChromeAiCompletion(entry, providerRuntime.targetLang, {
          onDownloadProgress,
        }).then(
          (translated) => ({ ok: true, translated }),
          (error) => ({ ok: false, error }),
        ),
      ),
    );
    const failure = settled.find((item) => !item.ok);
    if (failure) {
      const message = failure.error?.message || String(failure.error || "");
      return {
        ok: false,
        needModel: false,
        error: message || "Chrome 内置翻译失败。",
      };
    }
    return { ok: true, translations: settled.map((item) => item.translated) };
  }

  const batchPrompt = buildPageBatchTranslatePrompt(
    normalizedTexts,
    providerRuntime.targetLang,
  );
  let translations = [];
  let errorMessage = "";

  try {
    const batchRaw = await runProviderCompletion({
      provider: providerRuntime.provider,
      base: providerRuntime.base,
      model: providerRuntime.selectedModel,
      apiKey: providerRuntime.apiKey,
      prompt: batchPrompt,
      text: normalizedTexts.join("\n"),
      targetLang: providerRuntime.targetLang,
    });
    translations = parsePageBatchTranslations(batchRaw, normalizedTexts.length);
  } catch (error) {
    errorMessage = toProviderError(providerRuntime.provider, error);
  }

  if (
    translations.length !== normalizedTexts.length ||
    !translations.every(Boolean)
  ) {
    return {
      ok: false,
      needModel: false,
      rateLimited: isRateLimitError(errorMessage),
      error: errorMessage || "批量翻译结果解析失败。",
    };
  }

  return { ok: true, translations };
}

export async function translateWithProvider(text, tabId = null, options = {}) {
  const { settings: storedSettings } = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  const settings = normalizeRuntimeSettings(storedSettings);
  const {
    showPending = false,
    requestId = undefined,
    triggerSource = undefined,
    persistResult = true,
    learningModeOverride = null,
  } = options;
  const resolvedRequestId = createTranslateRequestId(requestId);
  registerLatestTranslateRequest(tabId, resolvedRequestId);
  const baseProviderRuntime = resolveProviderRuntime(settings);
  const providerRuntime = {
    ...baseProviderRuntime,
    targetLang: resolveTranslationTargetLang(
      text,
      baseProviderRuntime.targetLang,
    ),
  };
  const learningModeEnabled =
    !providerRuntime.isChromeAi &&
    (typeof learningModeOverride === "boolean"
      ? learningModeOverride
      : !!settings.learningModeEnabled);

  if (!settings.appEnabled) {
    return null;
  }

  if (showPending && tabId) {
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang: providerRuntime.targetLang,
        model: providerRuntime.selectedModel || null,
        learningModeEnabled,
        requestId: resolvedRequestId,
        triggerSource,
      }),
    );
  }

  if (
    providerRuntime.provider === PROVIDER_OLLAMA &&
    !providerRuntime.selectedModel
  ) {
    return buildNoModelResult(settings, text, providerRuntime, {
      requestId: resolvedRequestId,
      triggerSource,
      learningModeEnabled,
      persistResult,
    });
  }

  const credentialError = buildMissingCredentialError(providerRuntime, settings);
  if (credentialError) {
    const errorResult = buildCredentialErrorResult(
      text,
      providerRuntime,
      credentialError,
      {
        requestId: resolvedRequestId,
        triggerSource,
        learningModeEnabled,
      },
    );
    if (persistResult) {
      await persistTranslateResult(errorResult);
    }
    return errorResult;
  }

  const prompt = buildTranslatePrompt(text, providerRuntime.targetLang);
  let translation = "";
  let thinking = "";
  let error = null;
  let downloadProgress = null;
  let hasSentThinkingPreview = false;
  let latestSentenceStudyThinking = "";
  let firstSentenceStudyThinkingAt = 0;
  let hasFinalTranslateResult = false;
  let latestTranslateResult = null;
  let stopPendingUpdates = false;
  const MIN_SENTENCE_STUDY_THINK_PREVIEW_MS = 260;
  const sentenceStudyApiKey = providerRuntime.isMiniMax
    ? providerRuntime.minimaxApiKey
    : providerRuntime.isGitHub
      ? providerRuntime.githubToken
      : "";
  let sentenceStudyPromise = null;

  async function sendPendingProgress(force = false) {
    if (!showPending || !tabId || stopPendingUpdates) return;
    const now = Date.now();
    if (!force && now - sendPendingProgress.lastUpdateAt < 80) return;
    sendPendingProgress.lastUpdateAt = now;
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang: providerRuntime.targetLang,
        model: providerRuntime.selectedModel,
        learningModeEnabled,
        requestId: resolvedRequestId,
        triggerSource,
        translation: translation || null,
        thinking: thinking || null,
        sentenceStudyThinking: latestSentenceStudyThinking || null,
        sentenceStudyPending: learningModeEnabled,
        downloadProgress,
      }),
    );
    if (String(thinking || "").trim()) {
      hasSentThinkingPreview = true;
    }
  }
  sendPendingProgress.lastUpdateAt = 0;

  const pushSentenceStudyThinking = (thinkingText) => {
    const normalizedThinking = normalizeDisplayText(thinkingText);
    if (!normalizedThinking || normalizedThinking === latestSentenceStudyThinking) {
      return;
    }
    latestSentenceStudyThinking = normalizedThinking;
    if (!firstSentenceStudyThinkingAt) {
      firstSentenceStudyThinkingAt = Date.now();
    }
    if (!hasFinalTranslateResult) {
      void sendPendingProgress();
      return;
    }
    if (!latestTranslateResult?.sentenceStudyPending) return;

    const now = Date.now();
    if (now - pushSentenceStudyThinking.lastUpdateAt < 80) return;
    pushSentenceStudyThinking.lastUpdateAt = now;
    void sendTranslateResult(
      tabId,
      {
        ...latestTranslateResult,
        sentenceStudy: null,
        sentenceStudyThinking: latestSentenceStudyThinking,
        sentenceStudyPending: true,
      },
      "updateSentenceStudy",
    );
  };
  pushSentenceStudyThinking.lastUpdateAt = 0;

  if (learningModeEnabled) {
    sentenceStudyPromise = analyzeSentenceStudy(
      providerRuntime.base,
      providerRuntime.selectedModel,
      text,
      "",
      {
        provider: providerRuntime.provider,
        apiKey: sentenceStudyApiKey,
        onThinkingProgress: pushSentenceStudyThinking,
      },
    ).catch(() => null);
  }

  try {
    const streamed = await runProviderStreaming({
      provider: providerRuntime.provider,
      base: providerRuntime.base,
      model: providerRuntime.selectedModel,
      apiKey: providerRuntime.apiKey,
      prompt,
      text,
      targetLang: providerRuntime.targetLang,
      onChunk: (chunk) => {
        const parsed = splitThinkingFromText(chunk.response || "");
        translation = parsed.translation;
        thinking = mergeThinking(chunk.thinking || "", parsed.thinking);
        if (typeof chunk.downloadProgress === "number") {
          downloadProgress = chunk.downloadProgress;
        }
        void sendPendingProgress();
      },
    });
    const parsedFinal = splitThinkingFromText(streamed.response || translation);
    translation = parsedFinal.translation;
    thinking = mergeThinking(streamed.thinking || thinking, parsedFinal.thinking);
    await sendPendingProgress(true);
  } catch (e) {
    error = toProviderError(providerRuntime.provider, e);
  }

  const parsedOutput = splitThinkingFromText(translation);
  translation = parsedOutput.translation;
  thinking = mergeThinking(thinking, parsedOutput.thinking);

  if (!error && showPending && tabId && thinking) {
    if (!hasSentThinkingPreview) {
      await sendPendingProgress(true);
    }
    const elapsedSinceLastPending = Date.now() - sendPendingProgress.lastUpdateAt;
    if (elapsedSinceLastPending < MIN_THINK_PREVIEW_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_THINK_PREVIEW_MS - elapsedSinceLastPending),
      );
    }
  }

  const result = {
    original: text,
    translation: normalizeDisplayText(translation) || null,
    error,
    targetLang: providerRuntime.targetLang,
    model: providerRuntime.selectedModel,
    learningModeEnabled,
    thinking: normalizeDisplayText(thinking) || null,
    sentenceStudy: null,
    sentenceStudyThinking: latestSentenceStudyThinking || null,
    sentenceStudyPending:
      !error && !!translation && learningModeEnabled && !!sentenceStudyPromise,
    requestId: resolvedRequestId,
    triggerSource,
  };

  stopPendingUpdates = true;
  hasFinalTranslateResult = true;
  latestTranslateResult = result;
  const shouldCommitResult = isLatestTranslateRequest(tabId, resolvedRequestId);
  if (persistResult && shouldCommitResult) {
    await persistTranslateResult(result);
  }
  if (!error && result.translation) {
    await appendTranslationCache({
      original: text,
      translation: result.translation,
      targetLang: providerRuntime.targetLang,
      provider: providerRuntime.provider,
      model: providerRuntime.selectedModel,
      triggerSource,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  if (result.sentenceStudyPending && sentenceStudyPromise) {
    void (async () => {
      const sentenceStudyRaw = await sentenceStudyPromise.catch(() => null);
      const sentenceStudy = sentenceStudyRaw
        ? await hydrateSentenceStudyTranslations(
            sentenceStudyRaw,
            normalizeDisplayText(translation) || "",
          ).catch(() => sentenceStudyRaw)
        : null;

      if (
        latestSentenceStudyThinking &&
        firstSentenceStudyThinkingAt &&
        Date.now() - firstSentenceStudyThinkingAt <
          MIN_SENTENCE_STUDY_THINK_PREVIEW_MS
      ) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            MIN_SENTENCE_STUDY_THINK_PREVIEW_MS -
              (Date.now() - firstSentenceStudyThinkingAt),
          ),
        );
      }

      const nextResult = {
        ...result,
        sentenceStudy,
        sentenceStudyThinking:
          normalizeDisplayText(sentenceStudy?.thinking || "") ||
          latestSentenceStudyThinking ||
          null,
        sentenceStudyPending: false,
      };

      if (!isLatestTranslateRequest(tabId, resolvedRequestId)) {
        return;
      }

      latestTranslateResult = nextResult;
      if (persistResult) {
        await persistTranslateResult(nextResult);
      }
      await sendTranslateResult(tabId, nextResult, "updateSentenceStudy");
    })();
  }

  return result;
}
