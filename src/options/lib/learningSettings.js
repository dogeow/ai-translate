import {
  isChromeAiProvider,
  normalizeFeatureProvider,
} from "../../shared/settings.js";

export function resolveLearningProvider(settings = {}) {
  return normalizeFeatureProvider(
    settings.learningProvider,
    settings.provider,
    settings.addedProviders,
  );
}

export function isLearningModeSupported(settings = {}) {
  return !isChromeAiProvider(resolveLearningProvider(settings));
}
