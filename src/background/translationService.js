import {
  checkOllamaAndGetModels,
  generateOllamaResponse,
  generateOllamaStreamingResponse,
} from "./ollama.js";
import {
  analyzeSentenceStudy,
  hydrateSentenceStudyTranslations,
} from "./sentenceStudy.js";
import {
  getMiniMaxApiKeyLabel,
  normalizeTranslateProvider,
  resolveMiniMaxApiKey,
  isMiniMaxProvider,
  isGitHubModelsProvider,
  resolveGitHubToken,
} from "../shared/settings.js";
import {
  PROVIDER_OLLAMA,
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_API_KEY,
  DEFAULT_MINIMAX_API_KEY_CN,
  DEFAULT_MINIMAX_API_KEY_GLOBAL,
  DEFAULT_MINIMAX_REGION,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_GITHUB_MODELS_API_URL,
  DEFAULT_GITHUB_AUTH_MODE,
  DEFAULT_GITHUB_PAT,
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_LEARNING_MODE_ENABLED,
  DEFAULT_APP_ENABLED,
} from "../shared/constants.js";
import { getOllamaErrorMessage } from "../shared/ollama-errors.js";
import { filterTranslationModels } from "../shared/model-utils.js";
import {
  generateMiniMaxCompletion,
  generateMiniMaxStreamingCompletion,
  normalizeMiniMaxBaseUrl,
} from "../shared/minimax-api.js";
import {
  generateGitHubModelsCompletion,
  generateGitHubModelsStreamingCompletion,
  normalizeGitHubModelsBaseUrl,
} from "../shared/github-models-api.js";
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

const MIN_THINK_PREVIEW_MS = 320;
const latestTranslateRequestIdsByTab = new Map();

const SYNC_SETTINGS_DEFAULTS = {
  ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  minimaxApiUrl: DEFAULT_MINIMAX_API_URL,
  minimaxRegion: DEFAULT_MINIMAX_REGION,
  minimaxApiKey: DEFAULT_MINIMAX_API_KEY,
  minimaxApiKeyCn: DEFAULT_MINIMAX_API_KEY_CN,
  minimaxApiKeyGlobal: DEFAULT_MINIMAX_API_KEY_GLOBAL,
  minimaxModel: DEFAULT_MINIMAX_MODEL,
  githubApiUrl: DEFAULT_GITHUB_MODELS_API_URL,
  githubAuthMode: DEFAULT_GITHUB_AUTH_MODE,
  githubPat: DEFAULT_GITHUB_PAT,
  githubDeviceToken: DEFAULT_GITHUB_DEVICE_TOKEN,
  githubOAuthClientId: DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  githubModel: DEFAULT_GITHUB_MODEL,
  translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
  appEnabled: DEFAULT_APP_ENABLED,
};

function registerLatestTranslateRequest(tabId, requestId) {
  if (!tabId || !requestId) return;
  latestTranslateRequestIdsByTab.set(tabId, requestId);
}

function isLatestTranslateRequest(tabId, requestId) {
  if (!tabId || !requestId) return true;
  return latestTranslateRequestIdsByTab.get(tabId) === requestId;
}

function resolveProviderRuntime(settings) {
  const provider = normalizeTranslateProvider(
    settings.ollamaProvider,
    settings.minimaxRegion,
  );
  const isMiniMax = isMiniMaxProvider(provider);
  const isGitHub = isGitHubModelsProvider(provider);
  const selectedModel = isMiniMax
    ? settings.minimaxModel || DEFAULT_MINIMAX_MODEL
    : isGitHub
      ? settings.githubModel || DEFAULT_GITHUB_MODEL
      : settings.ollamaModel;
  const base = isMiniMax
    ? normalizeMiniMaxBaseUrl(settings.minimaxApiUrl)
    : isGitHub
      ? normalizeGitHubModelsBaseUrl(settings.githubApiUrl)
      : String(settings.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, "");
  const minimaxApiKey = resolveMiniMaxApiKey(settings);
  const githubToken = resolveGitHubToken(settings);
  const apiKey = isMiniMax ? minimaxApiKey : isGitHub ? githubToken : "";

  return {
    provider,
    isMiniMax,
    isGitHub,
    selectedModel,
    base,
    minimaxApiKey,
    githubToken,
    apiKey,
    targetLang: settings.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG,
  };
}

async function runProviderCompletion({ provider, base, model, apiKey, prompt }) {
  if (isMiniMaxProvider(provider)) {
    return generateMiniMaxCompletion(base, apiKey, model, prompt);
  }
  if (isGitHubModelsProvider(provider)) {
    return generateGitHubModelsCompletion(base, apiKey, model, prompt);
  }
  return generateOllamaResponse(base, model, prompt);
}

async function runProviderStreaming({
  provider,
  base,
  model,
  apiKey,
  prompt,
  onChunk,
}) {
  if (isMiniMaxProvider(provider)) {
    return generateMiniMaxStreamingCompletion(base, apiKey, model, prompt, {
      onChunk,
    });
  }
  if (isGitHubModelsProvider(provider)) {
    return generateGitHubModelsStreamingCompletion(base, apiKey, model, prompt, {
      onChunk,
    });
  }
  return generateOllamaStreamingResponse(base, model, prompt, { onChunk });
}

function toProviderError(provider, error) {
  if (isMiniMaxProvider(provider) || isGitHubModelsProvider(provider)) {
    return error?.message || String(error);
  }
  return getOllamaErrorMessage(error, { detailed: true });
}

function buildMissingCredentialError(providerRuntime, settings) {
  if (providerRuntime.provider === PROVIDER_OLLAMA) return "";
  if (providerRuntime.isMiniMax && !providerRuntime.apiKey) {
    return `请先填写${getMiniMaxApiKeyLabel(settings)}。`;
  }
  if (providerRuntime.isGitHub && !providerRuntime.apiKey) {
    return "请先填写 GitHub 访问令牌。";
  }
  return "";
}

export async function translatePageBatchWithProvider(texts) {
  const settings = await chrome.storage.sync.get(SYNC_SETTINGS_DEFAULTS);
  const MAX_TEXTS_PER_BATCH = 32;
  const normalizedTexts = Array.isArray(texts)
    ? texts.map((text) => String(text || "").trim()).filter(Boolean).slice(0, MAX_TEXTS_PER_BATCH)
    : [];
  if (normalizedTexts.length === 0) {
    return { ok: false, error: "empty_texts" };
  }
  if (!settings.appEnabled) {
    return { ok: false, disabled: true };
  }

  const providerRuntime = resolveProviderRuntime(settings);
  if (providerRuntime.provider === PROVIDER_OLLAMA && !providerRuntime.selectedModel) {
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
  const settings = await chrome.storage.sync.get(SYNC_SETTINGS_DEFAULTS);
  const {
    showPending = false,
    requestId = undefined,
    triggerSource = undefined,
    persistResult = true,
    learningModeOverride = null,
  } = options;
  const resolvedRequestId = createTranslateRequestId(requestId);
  registerLatestTranslateRequest(tabId, resolvedRequestId);
  const providerRuntime = resolveProviderRuntime(settings);
  const learningModeEnabled =
    typeof learningModeOverride === "boolean"
      ? learningModeOverride
      : !!settings.learningModeEnabled;

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

  if (providerRuntime.provider === PROVIDER_OLLAMA && !providerRuntime.selectedModel) {
    const check = await checkOllamaAndGetModels(settings.ollamaUrl);
    const errorResult = buildErrorResult({
      original: text,
      targetLang: providerRuntime.targetLang,
      error: check.error ? (check.error === "403" ? "403" : "connection") : "no_model",
      models: check.models,
      needModel: true,
      learningModeEnabled,
      requestId: resolvedRequestId,
      triggerSource,
    });
    if (persistResult) {
      await persistTranslateResult(errorResult);
    }
    return errorResult;
  }

  const credentialError = buildMissingCredentialError(providerRuntime, settings);
  if (credentialError) {
    const errorResult = buildErrorResult({
      original: text,
      targetLang: providerRuntime.targetLang,
      error: credentialError,
      model: providerRuntime.selectedModel || null,
      needModel: false,
      learningModeEnabled,
      requestId: resolvedRequestId,
      triggerSource,
    });
    if (persistResult) {
      await persistTranslateResult(errorResult);
    }
    return errorResult;
  }

  const prompt = buildTranslatePrompt(text, providerRuntime.targetLang);
  let translation = "";
  let thinking = "";
  let error = null;
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
      }),
    );
    if (String(thinking || "").trim()) {
      hasSentThinkingPreview = true;
    }
  }
  sendPendingProgress.lastUpdateAt = 0;

  const pushSentenceStudyThinking = (thinkingText) => {
    const normalizedThinking = normalizeDisplayText(thinkingText);
    if (!normalizedThinking || normalizedThinking === latestSentenceStudyThinking) return;
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
      onChunk: (chunk) => {
        const parsed = splitThinkingFromText(chunk.response || "");
        translation = parsed.translation;
        thinking = mergeThinking(chunk.thinking || "", parsed.thinking);
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
