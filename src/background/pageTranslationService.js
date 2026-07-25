import { checkOllamaAndGetModels } from "./ollama.js";
import {
  buildMissingCredentialError,
  normalizeRuntimeSettings,
  resolveProviderRuntime,
} from "./translationSettings.js";
import {
  runProviderCompletion,
  toProviderError,
} from "./translationProviders.js";
import { migrateSettingsIfNeeded } from "../shared/settings.js";
import { PROVIDER_OLLAMA } from "../shared/constants.js";
import { filterTranslationModels } from "../shared/model-utils.js";
import { generateChromeAiCompletion } from "../shared/chrome-ai-api.js";
import {
  buildPageBatchTranslatePrompt,
  isRateLimitError,
  parsePageBatchTranslations,
} from "../shared/utils/textProcessing.js";
import { resolveTranslationTargetLang } from "../shared/translation-language.js";

const MAX_TEXTS_PER_BATCH = 32;

export function groupPageTextsByTargetLang(texts, configuredTargetLang) {
  const groupsByTargetLang = new Map();

  texts.forEach((text, index) => {
    const targetLang = resolveTranslationTargetLang(
      text,
      configuredTargetLang,
    );
    const group = groupsByTargetLang.get(targetLang) || {
      targetLang,
      items: [],
    };
    group.items.push({ index, text });
    groupsByTargetLang.set(targetLang, group);
  });

  return Array.from(groupsByTargetLang.values());
}

export async function executePageTranslationGroups(groups, translateGroup) {
  const itemCount = groups.reduce(
    (count, group) =>
      Math.max(
        count,
        ...group.items.map((item) => item.index + 1),
      ),
    0,
  );
  const translations = new Array(itemCount).fill("");

  for (const group of groups) {
    const sourceTexts = group.items.map((item) => item.text);
    const result = await translateGroup(sourceTexts, group.targetLang);
    if (!result?.ok) {
      const { translations: _partialTranslations, ...failure } = result || {};
      return {
        ok: false,
        error: "批量翻译失败。",
        ...failure,
      };
    }
    if (
      !Array.isArray(result.translations) ||
      result.translations.length !== group.items.length ||
      !result.translations.every(Boolean)
    ) {
      return {
        ok: false,
        needModel: false,
        error: "批量翻译结果解析失败。",
      };
    }

    group.items.forEach((item, resultIndex) => {
      translations[item.index] = result.translations[resultIndex];
    });
  }

  return { ok: true, translations };
}

export async function translatePageTargetGroup(
  texts,
  providerRuntime,
  options = {},
  dependencies = {},
) {
  const generateChromeCompletion =
    dependencies.generateChromeAiCompletion || generateChromeAiCompletion;
  const runCompletion =
    dependencies.runProviderCompletion || runProviderCompletion;
  const mapProviderError = dependencies.toProviderError || toProviderError;

  if (providerRuntime.isChromeAi) {
    const settled = await Promise.all(
      texts.map((text) =>
        generateChromeCompletion(text, providerRuntime.targetLang, {
          onDownloadProgress: options.onDownloadProgress,
        }).then(
          (translated) => ({
            ok: true,
            translated: String(translated || "").trim(),
          }),
          (error) => ({ ok: false, error }),
        ),
      ),
    );
    const failure = settled.find((item) => !item.ok);
    if (failure) {
      const message = failure.error?.message || String(failure.error || "");
      return {
        ok: false,
        needModel: false,
        error: message || "Chrome 内置翻译失败。",
      };
    }
    return {
      ok: true,
      translations: settled.map((item) => item.translated),
    };
  }

  const prompt = buildPageBatchTranslatePrompt(
    texts,
    providerRuntime.targetLang,
  );
  let translations = [];
  let errorMessage = "";

  try {
    const rawResult = await runCompletion({
      provider: providerRuntime.provider,
      base: providerRuntime.base,
      model: providerRuntime.selectedModel,
      apiKey: providerRuntime.apiKey,
      prompt,
      text: texts.join("\n"),
      targetLang: providerRuntime.targetLang,
    });
    translations = parsePageBatchTranslations(rawResult, texts.length);
  } catch (error) {
    errorMessage = mapProviderError(providerRuntime.provider, error);
  }

  if (
    translations.length !== texts.length ||
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

export async function translatePageBatchWithProvider(texts, options = {}) {
  const { settings: storedSettings } = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  const settings = normalizeRuntimeSettings(storedSettings);
  const normalizedTexts = Array.isArray(texts)
    ? texts
        .map((text) => String(text || "").trim())
        .filter(Boolean)
        .slice(0, MAX_TEXTS_PER_BATCH)
    : [];

  if (normalizedTexts.length === 0) {
    return { ok: false, error: "empty_texts" };
  }
  if (!settings.appEnabled) {
    return { ok: false, disabled: true };
  }

  const baseProviderRuntime = resolveProviderRuntime(settings);
  if (
    baseProviderRuntime.provider === PROVIDER_OLLAMA &&
    !baseProviderRuntime.selectedModel
  ) {
    const check = await checkOllamaAndGetModels(settings.ollamaUrl);
    return {
      ok: false,
      needModel: true,
      models: filterTranslationModels(check.models || []),
      error: check.error
        ? check.error === "403"
          ? "403"
          : "connection"
        : "no_model",
    };
  }

  const credentialError = buildMissingCredentialError(
    baseProviderRuntime,
    settings,
  );
  if (credentialError) {
    return { ok: false, needModel: false, error: credentialError };
  }

  const groups = groupPageTextsByTargetLang(
    normalizedTexts,
    baseProviderRuntime.targetLang,
  );
  return executePageTranslationGroups(groups, (groupTexts, targetLang) =>
    translatePageTargetGroup(
      groupTexts,
      { ...baseProviderRuntime, targetLang },
      options,
    ),
  );
}
