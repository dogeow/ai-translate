import {
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
  PROVIDER_GITHUB_MODELS,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_OLLAMA,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";
import {
  normalizeAllSettings,
  normalizeVerifiedProviders,
} from "../../shared/settings.js";

export function getVerifiedProviderOptions(
  settings = {},
  { chromeAiReady = null } = {},
) {
  const normalized = normalizeAllSettings(settings);
  const verifiedProviders = new Set(
    normalizeVerifiedProviders(
      normalized.verifiedProviders,
      normalized.addedProviders,
    ),
  );
  if (chromeAiReady === true) {
    verifiedProviders.add(PROVIDER_CHROME_AI);
  } else if (chromeAiReady === false) {
    verifiedProviders.delete(PROVIDER_CHROME_AI);
  }

  return TRANSLATE_PROVIDER_OPTIONS.filter((option) =>
    normalized.addedProviders.includes(option.value) &&
    verifiedProviders.has(option.value),
  );
}

export function getConfiguredProviderModel(settings = {}, provider) {
  const normalized = normalizeAllSettings(settings);
  if (provider === PROVIDER_CHROME_AI) return "chrome-translator";
  if (
    provider === PROVIDER_MINIMAX_CN ||
    provider === PROVIDER_MINIMAX_GLOBAL
  ) {
    return normalized.minimaxModel;
  }
  if (provider === PROVIDER_GITHUB_MODELS) return normalized.githubModel;
  if (provider === PROVIDER_CHATGPT) return normalized.chatgptModel;
  if (provider === PROVIDER_OLLAMA) return normalized.ollamaModel;
  return "";
}

export function getVerifiedModelOptions(
  settings = {},
  { chromeAiReady = null, includeChromeAi = true } = {},
) {
  return getVerifiedProviderOptions(settings, { chromeAiReady })
    .filter(
      (option) => includeChromeAi || option.value !== PROVIDER_CHROME_AI,
    )
    .map((option) => {
      const model = getConfiguredProviderModel(settings, option.value);
      return {
        ...option,
        model,
        label:
          option.value === PROVIDER_CHROME_AI || !model
            ? option.label
            : `${option.label} · ${model}`,
      };
    });
}
