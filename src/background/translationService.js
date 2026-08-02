import { checkOllamaAndGetModels } from "./ollama.js";
import {
  analyzeSentenceStudy,
  hydrateSentenceStudyTranslations,
} from "./sentenceStudy.js";
import {
  normalizeRuntimeSettings,
  PROVIDER_PURPOSE,
  resolveProviderRuntime,
  resolvePurposeProviderRuntime,
  buildMissingCredentialError,
} from "./translationSettings.js";
import { migrateSettingsIfNeeded } from "../shared/settings.js";
import {
  toProviderError,
} from "./translationProviders.js";
import { executeStreamingTranslation } from "./translationExecution.js";
import {
  PROVIDER_OLLAMA,
  WORD_LOOKUP_PROVIDER_YOUDAO,
} from "../shared/constants.js";
import { isPronounceableEnglishWord } from "../shared/youdao-api.js";
import {
  formatWordTranslations,
  YOUDAO_WORD_SOURCE_LABEL,
} from "../shared/word-lookup.js";
import { lookupWordCached } from "./wordLookupService.js";
import {
  normalizeDisplayText,
  splitThinkingFromText,
  mergeThinking,
  buildTranslatePrompt,
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

export function shouldUseConfiguredWordLookup(
  text,
  triggerSource,
  options = {},
) {
  return (
    options.useWordLookup !== false &&
    triggerSource !== "page-visual" &&
    isPronounceableEnglishWord(text)
  );
}

function getPendingWordLookupModel(settings) {
  if (settings.wordLookupProvider === WORD_LOOKUP_PROVIDER_YOUDAO) {
    return YOUDAO_WORD_SOURCE_LABEL;
  }
  return (
    resolveProviderRuntime(settings, {
      provider: settings.wordLookupProvider,
    }).selectedModel || "AI"
  );
}

async function translateWordWithConfiguredProvider({
  text,
  tabId,
  settings,
  showPending,
  requestId,
  triggerSource,
  persistResult,
}) {
  const pendingModel = getPendingWordLookupModel(settings);
  if (showPending && tabId) {
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang: "Chinese",
        model: pendingModel,
        learningModeEnabled: false,
        requestId,
        triggerSource,
      }),
    );
  }

  const lookup = await lookupWordCached(text, { settings });
  const result = lookup.ok
    ? {
        original: text,
        translation: formatWordTranslations(lookup.translations) || null,
        error: null,
        targetLang: "Chinese",
        provider: lookup.provider,
        model: lookup.model || lookup.sourceLabel || pendingModel,
        learningModeEnabled: false,
        thinking: null,
        sentenceStudy: null,
        sentenceStudyThinking: null,
        sentenceStudyPending: false,
        requestId,
        triggerSource,
        wordLookupFallback: lookup.fallback === true,
      }
    : buildErrorResult({
        original: text,
        targetLang: "Chinese",
        error: lookup.error || "单词查询失败。",
        model: pendingModel,
        learningModeEnabled: false,
        requestId,
        triggerSource,
      });

  const shouldCommitResult = isLatestTranslateRequest(tabId, requestId);
  if (persistResult && shouldCommitResult) {
    await persistTranslateResult(result);
  }
  if (!result.error && result.translation) {
    await appendTranslationCache({
      original: text,
      translation: result.translation,
      targetLang: result.targetLang,
      provider: lookup.provider,
      model: result.model,
      triggerSource,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }
  return result;
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
  const baseProviderRuntime = resolvePurposeProviderRuntime(
    settings,
    PROVIDER_PURPOSE.TRANSLATION,
  );
  const learningProviderRuntime = resolvePurposeProviderRuntime(
    settings,
    PROVIDER_PURPOSE.LEARNING,
  );
  const providerRuntime = {
    ...baseProviderRuntime,
    targetLang: resolveTranslationTargetLang(
      text,
      baseProviderRuntime.targetLang,
    ),
  };
  const learningCredentialError = buildMissingCredentialError(
    learningProviderRuntime,
    settings,
  );
  const learningModeEnabled =
    !learningProviderRuntime.isChromeAi &&
    !learningCredentialError &&
    (learningProviderRuntime.provider !== PROVIDER_OLLAMA ||
      !!learningProviderRuntime.selectedModel) &&
    (typeof learningModeOverride === "boolean"
      ? learningModeOverride
      : !!settings.learningModeEnabled);

  if (!settings.appEnabled) {
    return null;
  }

  if (shouldUseConfiguredWordLookup(text, triggerSource, options)) {
    return translateWordWithConfiguredProvider({
      text,
      tabId,
      settings,
      showPending,
      requestId: resolvedRequestId,
      triggerSource,
      persistResult,
    });
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
  const sentenceStudyApiKey = learningProviderRuntime.apiKey;
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
      learningProviderRuntime.base,
      learningProviderRuntime.selectedModel,
      text,
      "",
      {
        provider: learningProviderRuntime.provider,
        apiKey: sentenceStudyApiKey,
        onThinkingProgress: pushSentenceStudyThinking,
      },
    ).catch(() => null);
  }

  try {
    const executed = await executeStreamingTranslation({
      providerRuntime,
      prompt,
      text,
      onProgress: (progress) => {
        translation = progress.translation;
        thinking = progress.thinking;
        downloadProgress = progress.downloadProgress;
        void sendPendingProgress();
      },
    });
    translation = executed.translation;
    thinking = executed.thinking;
    downloadProgress = executed.downloadProgress;
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
