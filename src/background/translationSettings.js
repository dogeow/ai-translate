import {
  getMiniMaxApiKeyLabel,
  getDefaultMiniMaxApiUrlByRegion,
  getMiniMaxRegionFromProvider,
  isMiniMaxGlobalApiUrl,
  normalizeAllSettings,
  normalizeTranslateProvider,
  resolveMiniMaxApiKey,
  isMiniMaxProvider,
  isGitHubModelsProvider,
  isChatGptProvider,
  isChromeAiProvider,
  resolveGitHubToken,
  getGitHubDeviceLoginPrompt,
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
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  DEFAULT_CHATGPT_CODEX_API_URL,
  DEFAULT_CHATGPT_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_LEARNING_MODE_ENABLED,
  DEFAULT_APP_ENABLED,
} from "../shared/constants.js";
import { normalizeMiniMaxBaseUrl } from "../shared/minimax-api.js";
import { normalizeGitHubModelsBaseUrl } from "../shared/github-models-api.js";

export const SYNC_SETTINGS_DEFAULTS = {
  provider: DEFAULT_TRANSLATE_PROVIDER,
  uiRewriteProvider: DEFAULT_TRANSLATE_PROVIDER,
  learningProvider: DEFAULT_TRANSLATE_PROVIDER,
  addedProviders: [DEFAULT_TRANSLATE_PROVIDER],
  verifiedProviders: [],
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
  githubDeviceToken: DEFAULT_GITHUB_DEVICE_TOKEN,
  githubOAuthClientId: DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  githubModel: DEFAULT_GITHUB_MODEL,
  chatgptModel: DEFAULT_CHATGPT_MODEL,
  translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
  appEnabled: DEFAULT_APP_ENABLED,
};

export const PROVIDER_PURPOSE = Object.freeze({
  TRANSLATION: "translation",
  UI_REWRITE: "uiRewrite",
  LEARNING: "learning",
});

export function normalizeRuntimeSettings(settings = {}) {
  const normalized = normalizeAllSettings(settings);
  return {
    ...normalized,
    learningModeEnabled:
      settings.learningModeEnabled ?? normalized.learningModeEnabled,
    appEnabled: settings.appEnabled !== false,
  };
}

export function resolveProviderRuntime(settings, options = {}) {
  const normalized = normalizeRuntimeSettings(settings);
  const provider = normalizeTranslateProvider(
    options.provider ?? normalized.provider,
    normalized.minimaxRegion,
  );
  const isProviderAdded = normalized.addedProviders.includes(provider);
  const isMiniMax = isMiniMaxProvider(provider);
  const isGitHub = isGitHubModelsProvider(provider);
  const isChatGpt = isChatGptProvider(provider);
  const isChromeAi = isChromeAiProvider(provider);
  const selectedModel = isChromeAi
    ? "chrome-translator"
    : isMiniMax
      ? normalized.minimaxModel || DEFAULT_MINIMAX_MODEL
      : isGitHub
        ? normalized.githubModel || DEFAULT_GITHUB_MODEL
        : isChatGpt
          ? normalized.chatgptModel || DEFAULT_CHATGPT_MODEL
        : normalized.ollamaModel;
  const featureMiniMaxRegion = isMiniMax
    ? getMiniMaxRegionFromProvider(provider)
    : normalized.minimaxRegion;
  const storedMiniMaxUrlMatchesProvider = isMiniMax
    ? isMiniMaxGlobalApiUrl(normalized.minimaxApiUrl) ===
      (featureMiniMaxRegion === "global")
    : false;
  const minimaxBaseUrl = storedMiniMaxUrlMatchesProvider
    ? normalized.minimaxApiUrl
    : getDefaultMiniMaxApiUrlByRegion(featureMiniMaxRegion);
  const base = isChromeAi
    ? ""
    : isMiniMax
      ? normalizeMiniMaxBaseUrl(minimaxBaseUrl)
      : isGitHub
        ? normalizeGitHubModelsBaseUrl(normalized.githubApiUrl)
        : isChatGpt
          ? DEFAULT_CHATGPT_CODEX_API_URL
        : String(normalized.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, "");
  const minimaxApiKey = resolveMiniMaxApiKey({
    ...normalized,
    provider,
    minimaxRegion: featureMiniMaxRegion,
  });
  const githubToken = resolveGitHubToken(normalized);
  const apiKey = isMiniMax ? minimaxApiKey : isGitHub ? githubToken : "";

  return {
    provider,
    isProviderAdded,
    isMiniMax,
    isGitHub,
    isChatGpt,
    isChromeAi,
    selectedModel,
    base,
    minimaxApiKey,
    githubToken,
    apiKey,
    targetLang:
      normalized.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG,
  };
}

export function resolvePurposeProviderRuntime(
  settings,
  purpose = PROVIDER_PURPOSE.TRANSLATION,
) {
  const normalized = normalizeRuntimeSettings(settings);
  const provider =
    purpose === PROVIDER_PURPOSE.UI_REWRITE
      ? normalized.uiRewriteProvider
      : purpose === PROVIDER_PURPOSE.LEARNING
        ? normalized.learningProvider
        : normalized.provider;
  return resolveProviderRuntime(normalized, { provider });
}

export function buildMissingCredentialError(providerRuntime, settings) {
  if (!providerRuntime.isProviderAdded) {
    return "请先新增并验证翻译引擎。";
  }
  if (providerRuntime.provider === PROVIDER_OLLAMA) return "";
  if (providerRuntime.isMiniMax && !providerRuntime.apiKey) {
    return `请先填写${getMiniMaxApiKeyLabel({
      ...settings,
      provider: providerRuntime.provider,
    })}。`;
  }
  if (providerRuntime.isGitHub && !providerRuntime.apiKey) {
    return getGitHubDeviceLoginPrompt(settings);
  }
  return "";
}
