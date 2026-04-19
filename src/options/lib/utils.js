import {
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_GITHUB_MODELS,
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_MINIMAX_API_KEY_CN,
  DEFAULT_MINIMAX_API_KEY_GLOBAL,
  DEFAULT_MINIMAX_REGION,
  MINIMAX_REGION_CN,
  MINIMAX_REGION_GLOBAL,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_GITHUB_MODELS_API_URL,
  DEFAULT_GITHUB_AUTH_MODE,
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  ORIGINS_PLATFORM_CONTENT,
} from "./constants.js";

// 从共享模块导入
import { formatModelSize } from "../../shared/model-utils.js";
import {
  normalizeTranslateProvider,
  normalizeMiniMaxApiUrl,
  normalizeMiniMaxRegion,
  getDefaultMiniMaxApiUrlByRegion,
  getMiniMaxRegionFromProvider,
  isMiniMaxGlobalApiUrl,
  isMiniMaxProvider,
  isGitHubModelsProvider,
  resolveMiniMaxApiKey,
  getMiniMaxApiKeyLabel,
  normalizeGitHubApiUrl,
  normalizeGitHubAuthMode,
  resolveGitHubToken,
  getGitHubTokenLabel,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
} from "../../shared/settings.js";
import { generateCompletion } from "../../shared/ollama-api.js";
import { generateMiniMaxCompletion } from "../../shared/minimax-api.js";
import { generateGitHubModelsCompletion } from "../../shared/github-models-api.js";

// 重新导出
export { formatModelSize };
export {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
};

export function getSettingsSnapshot(settings) {
  const url = (
    String(settings.ollamaUrl || "").trim() || DEFAULT_OLLAMA_URL
  ).replace(/\/$/, "");
  const base = url.startsWith("http") ? url : `http://${url}`;
  const provider = normalizeTranslateProvider(
    settings.ollamaProvider || DEFAULT_TRANSLATE_PROVIDER,
    settings.minimaxRegion,
  );
  const minimaxRegion = isMiniMaxProvider(provider)
    ? getMiniMaxRegionFromProvider(provider)
    : normalizeMiniMaxRegion(
        settings.minimaxRegion ||
          (isMiniMaxGlobalApiUrl(settings.minimaxApiUrl)
            ? MINIMAX_REGION_GLOBAL
            : DEFAULT_MINIMAX_REGION),
      );
  const minimaxApiUrlRaw = String(settings.minimaxApiUrl || "").trim();
  const minimaxApiUrl = minimaxApiUrlRaw
    ? normalizeMiniMaxApiUrl(minimaxApiUrlRaw)
    : getDefaultMiniMaxApiUrlByRegion(minimaxRegion);
  const minimaxApiKeyCn = String(
    settings.minimaxApiKeyCn ??
      settings.minimaxApiKey ??
      DEFAULT_MINIMAX_API_KEY_CN,
  ).trim();
  const minimaxApiKeyGlobal = String(
    settings.minimaxApiKeyGlobal ??
      settings.minimaxApiKey ??
      DEFAULT_MINIMAX_API_KEY_GLOBAL,
  ).trim();
  const minimaxApiKey = resolveMiniMaxApiKey({
    ollamaProvider: provider,
    minimaxRegion,
    minimaxApiUrl,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxApiKey: settings.minimaxApiKey,
  });
  const githubApiUrl = normalizeGitHubApiUrl(settings.githubApiUrl);
  const githubAuthMode = normalizeGitHubAuthMode(settings.githubAuthMode);
  const githubDeviceToken = String(
    settings.githubDeviceToken ?? DEFAULT_GITHUB_DEVICE_TOKEN,
  ).trim();
  const githubOAuthClientId = String(
    settings.githubOAuthClientId ?? DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  ).trim();
  const githubToken = resolveGitHubToken({
    githubAuthMode,
    githubDeviceToken,
  });

  return {
    ollamaProvider: provider,
    ollamaUrl: base,
    ollamaModel:
      String(settings.ollamaModel || "").trim() || DEFAULT_OLLAMA_MODEL,
    minimaxApiUrl,
    minimaxRegion,
    minimaxApiKey,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxModel:
      String(settings.minimaxModel || "").trim() || DEFAULT_MINIMAX_MODEL,
    githubApiUrl,
    githubAuthMode,
    githubDeviceToken,
    githubOAuthClientId,
    githubToken,
    githubModel:
      String(settings.githubModel || "").trim() || DEFAULT_GITHUB_MODEL,
    translateTargetLang:
      settings.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      settings.ollamaAutoTranslateMode,
    ),
    ollamaAutoTranslateSelection:
      normalizeAutoTranslateMode(settings.ollamaAutoTranslateMode) ===
      "selection",
    ollamaHoverTranslateScope: normalizeHoverTranslateScope(
      settings.ollamaHoverTranslateScope,
    ),
    ollamaHoverTranslateDelayMs: normalizeHoverTranslateDelayMs(
      settings.ollamaHoverTranslateDelayMs,
    ),
    ollamaPageTranslateConcurrency: normalizePageTranslateConcurrency(
      settings.ollamaPageTranslateConcurrency,
    ),
    ollamaPageTranslateBatchChars: normalizePageTranslateBatchChars(
      settings.ollamaPageTranslateBatchChars,
    ),
    learningModeEnabled: !!settings.learningModeEnabled,
  };
}

export function getConfig(settings) {
  const snapshot = getSettingsSnapshot(settings);
  if (isMiniMaxProvider(snapshot.ollamaProvider)) {
    const apiKey = resolveMiniMaxApiKey(snapshot);
    return {
      provider: snapshot.ollamaProvider,
      base: snapshot.minimaxApiUrl,
      model: snapshot.minimaxModel,
      apiKey,
      apiKeyLabel: getMiniMaxApiKeyLabel(snapshot),
    };
  }

  if (isGitHubModelsProvider(snapshot.ollamaProvider)) {
    const apiKey = resolveGitHubToken(snapshot);
    return {
      provider: snapshot.ollamaProvider,
      base: snapshot.githubApiUrl,
      model: snapshot.githubModel,
      apiKey,
      apiKeyLabel: getGitHubTokenLabel(snapshot),
    };
  }

  return {
    provider: PROVIDER_OLLAMA,
    base: snapshot.ollamaUrl,
    model: snapshot.ollamaModel,
    apiKey: "",
    apiKeyLabel: "",
  };
}

export function getStoredSettingsShape(stored) {
  const normalizedProvider = normalizeTranslateProvider(
    stored.ollamaProvider || DEFAULT_TRANSLATE_PROVIDER,
    stored.minimaxRegion,
  );
  const minimaxRegion = isMiniMaxProvider(normalizedProvider)
    ? getMiniMaxRegionFromProvider(normalizedProvider)
    : normalizeMiniMaxRegion(
        stored.minimaxRegion ||
          (isMiniMaxGlobalApiUrl(stored.minimaxApiUrl)
            ? MINIMAX_REGION_GLOBAL
            : DEFAULT_MINIMAX_REGION),
      );
  const minimaxApiUrlRaw = String(stored.minimaxApiUrl || "").trim();
  const minimaxApiUrl = minimaxApiUrlRaw
    ? normalizeMiniMaxApiUrl(minimaxApiUrlRaw)
    : getDefaultMiniMaxApiUrlByRegion(minimaxRegion);
  const minimaxApiKeyCn = String(
    stored.minimaxApiKeyCn ??
      stored.minimaxApiKey ??
      DEFAULT_MINIMAX_API_KEY_CN,
  ).trim();
  const minimaxApiKeyGlobal = String(
    stored.minimaxApiKeyGlobal ??
      stored.minimaxApiKey ??
      DEFAULT_MINIMAX_API_KEY_GLOBAL,
  ).trim();
  const minimaxApiKey = resolveMiniMaxApiKey({
    ollamaProvider: normalizedProvider,
    minimaxRegion,
    minimaxApiUrl,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxApiKey: stored.minimaxApiKey,
  });
  const githubApiUrl = normalizeGitHubApiUrl(stored.githubApiUrl);
  const githubAuthMode = normalizeGitHubAuthMode(stored.githubAuthMode);
  const githubDeviceToken = String(
    stored.githubDeviceToken ?? DEFAULT_GITHUB_DEVICE_TOKEN,
  ).trim();
  const githubOAuthClientId = String(
    stored.githubOAuthClientId ?? DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  ).trim();
  const githubToken = resolveGitHubToken({
    githubAuthMode,
    githubDeviceToken,
  });

  return {
    ollamaProvider: normalizedProvider,
    ollamaUrl: stored.ollamaUrl || DEFAULT_OLLAMA_URL,
    ollamaModel: stored.ollamaModel || DEFAULT_OLLAMA_MODEL,
    minimaxApiUrl,
    minimaxRegion,
    minimaxApiKey,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxModel: stored.minimaxModel || DEFAULT_MINIMAX_MODEL,
    githubApiUrl,
    githubAuthMode,
    githubDeviceToken,
    githubOAuthClientId,
    githubToken,
    githubModel: stored.githubModel || DEFAULT_GITHUB_MODEL,
    translateTargetLang:
      stored.translateTargetLang ?? DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      stored.ollamaAutoTranslateMode,
      stored.ollamaAutoTranslateSelection,
    ),
    ollamaHoverTranslateScope: normalizeHoverTranslateScope(
      stored.ollamaHoverTranslateScope,
    ),
    ollamaHoverTranslateDelayMs: String(
      normalizeHoverTranslateDelayMs(stored.ollamaHoverTranslateDelayMs),
    ),
    ollamaPageTranslateConcurrency: String(
      normalizePageTranslateConcurrency(
        stored.ollamaPageTranslateConcurrency ??
          DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
      ),
    ),
    ollamaPageTranslateBatchChars: String(
      normalizePageTranslateBatchChars(
        stored.ollamaPageTranslateBatchChars ??
          DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
      ),
    ),
    learningModeEnabled: !!stored.learningModeEnabled,
  };
}

export function runGenerateRequest(config, prompt) {
  if (isMiniMaxProvider(config.provider)) {
    return generateMiniMaxCompletion(
      config.base,
      config.apiKey,
      config.model,
      prompt,
    );
  }
  if (isGitHubModelsProvider(config.provider)) {
    return generateGitHubModelsCompletion(
      config.base,
      config.apiKey,
      config.model,
      prompt,
    );
  }
  return generateCompletion(config.base, config.model, prompt);
}

export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform =
    navigator.userAgentData?.platform?.toLowerCase() ||
    (navigator.platform || "").toLowerCase();

  if (/win/.test(platform) || /win/.test(userAgent)) return "win";
  if (/linux/.test(platform) || /linux/.test(userAgent)) return "linux";
  return "macos";
}

export function getOrderedOriginsPlatforms() {
  const current = detectPlatform();
  return [
    current,
    ...Object.keys(ORIGINS_PLATFORM_CONTENT).filter((key) => key !== current),
  ];
}

export function formatShortcut(shortcut) {
  if (!shortcut) return "";
  return shortcut
    .replace(/^Alt\+/i, "Alt+")
    .replace(/^Ctrl\+/i, "Ctrl+")
    .replace(/^Command\+/i, "⌘+")
    .replace(/^MacCtrl\+/i, "Ctrl+");
}
