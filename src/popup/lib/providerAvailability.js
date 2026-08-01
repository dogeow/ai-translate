import {
  PROVIDER_CHROME_AI,
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
