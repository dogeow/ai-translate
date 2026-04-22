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

function toStoredSettingsInput(settings = {}) {
  return {
    ...settings,
    ollamaProvider: settings.ollamaProvider ?? settings.provider,
    ollamaAutoTranslateMode:
      settings.ollamaAutoTranslateMode ?? settings.autoTranslateMode,
    ollamaHoverTranslateScope:
      settings.ollamaHoverTranslateScope ?? settings.hoverTranslateScope,
    ollamaHoverTranslateDelayMs:
      settings.ollamaHoverTranslateDelayMs ?? settings.hoverTranslateDelayMs,
    ollamaPageTranslateConcurrency:
      settings.ollamaPageTranslateConcurrency ??
      settings.pageTranslateConcurrency,
    ollamaPageTranslateBatchChars:
      settings.ollamaPageTranslateBatchChars ?? settings.pageTranslateBatchChars,
  };
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
    ollamaAutoTranslateSelection:
      normalized.ollamaAutoTranslateMode === "selection",
  };
}

export function getConfig(settings = {}) {
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
    ollamaHoverTranslateDelayMs: String(
      normalized.ollamaHoverTranslateDelayMs,
    ),
    ollamaPageTranslateConcurrency: String(
      normalized.ollamaPageTranslateConcurrency,
    ),
    ollamaPageTranslateBatchChars: String(
      normalized.ollamaPageTranslateBatchChars,
    ),
  };
}

export function getInitialSettings() {
  return getStoredSettingsShape(toStoredSettingsInput(DEFAULT_SETTINGS));
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