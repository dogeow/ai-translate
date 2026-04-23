import { PROVIDER_OLLAMA } from "../../shared/constants.js";
import { formatModelSize } from "../../shared/model-utils.js";
import {
  DEFAULT_SETTINGS,
  isMiniMaxProvider,
  isGitHubModelsProvider,
  resolveMiniMaxApiKey,
  getMiniMaxApiKeyLabel,
  resolveGitHubToken,
  getGitHubTokenLabel,
  normalizeAllSettings,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
} from "../../shared/settings.js";
import { generateCompletion } from "../../shared/ollama-api.js";
import { generateMiniMaxCompletion } from "../../shared/minimax-api.js";
import { generateGitHubModelsCompletion } from "../../shared/github-models-api.js";

export {
  formatModelSize,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
};

function normalizeOllamaUrlForStorage(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_SETTINGS.ollamaUrl;

  const withoutTrailingSlash = raw.replace(/\/$/, "");
  return /^https?:\/\//i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `http://${withoutTrailingSlash}`;
}

function normalizeModelInput(value, fallback) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

export function getSettingsSnapshot(settings = {}) {
  const normalized = normalizeAllSettings(settings);
  return {
    ...normalized,
    ollamaUrl: normalizeOllamaUrlForStorage(
      settings.ollamaUrl ?? normalized.ollamaUrl,
    ),
    ollamaModel: normalizeModelInput(
      settings.ollamaModel,
      DEFAULT_SETTINGS.ollamaModel,
    ),
    minimaxModel: normalizeModelInput(
      settings.minimaxModel,
      DEFAULT_SETTINGS.minimaxModel,
    ),
    githubModel: normalizeModelInput(
      settings.githubModel,
      DEFAULT_SETTINGS.githubModel,
    ),
  };
}

export function getConfig(settings = {}) {
  const snapshot = getSettingsSnapshot(settings);
  if (isMiniMaxProvider(snapshot.provider)) {
    const apiKey = resolveMiniMaxApiKey(snapshot);
    return {
      provider: snapshot.provider,
      base: snapshot.minimaxApiUrl,
      model: snapshot.minimaxModel,
      apiKey,
      apiKeyLabel: getMiniMaxApiKeyLabel(snapshot),
    };
  }

  if (isGitHubModelsProvider(snapshot.provider)) {
    const apiKey = resolveGitHubToken(snapshot);
    return {
      provider: snapshot.provider,
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

export function getStoredSettingsShape(stored = {}) {
  const normalized = normalizeAllSettings(stored);
  return {
    ...normalized,
    ollamaUrl: normalizeOllamaUrlForStorage(
      stored.ollamaUrl ?? normalized.ollamaUrl,
    ),
    ollamaModel: normalizeModelInput(
      stored.ollamaModel,
      DEFAULT_SETTINGS.ollamaModel,
    ),
    minimaxModel: normalizeModelInput(
      stored.minimaxModel,
      DEFAULT_SETTINGS.minimaxModel,
    ),
    githubModel: normalizeModelInput(
      stored.githubModel,
      DEFAULT_SETTINGS.githubModel,
    ),
    hoverTranslateDelayMs: String(normalized.hoverTranslateDelayMs),
    pageTranslateConcurrency: String(normalized.pageTranslateConcurrency),
    pageTranslateBatchChars: String(normalized.pageTranslateBatchChars),
  };
}

export function getInitialSettings() {
  return getStoredSettingsShape(DEFAULT_SETTINGS);
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