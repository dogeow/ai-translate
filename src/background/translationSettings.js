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
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_LEARNING_MODE_ENABLED,
  DEFAULT_APP_ENABLED,
} from "../shared/constants.js";
import { normalizeMiniMaxBaseUrl } from "../shared/minimax-api.js";
import { normalizeGitHubModelsBaseUrl } from "../shared/github-models-api.js";

export const SYNC_SETTINGS_DEFAULTS = {
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
  githubDeviceToken: DEFAULT_GITHUB_DEVICE_TOKEN,
  githubOAuthClientId: DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  githubModel: DEFAULT_GITHUB_MODEL,
  translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
  appEnabled: DEFAULT_APP_ENABLED,
};

export function resolveProviderRuntime(settings) {
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

export function buildMissingCredentialError(providerRuntime, settings) {
  if (providerRuntime.provider === PROVIDER_OLLAMA) return "";
  if (providerRuntime.isMiniMax && !providerRuntime.apiKey) {
    return `请先填写${getMiniMaxApiKeyLabel(settings)}。`;
  }
  if (providerRuntime.isGitHub && !providerRuntime.apiKey) {
    return "请先填写 GitHub 访问令牌。";
  }
  return "";
}
