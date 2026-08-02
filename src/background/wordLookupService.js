import {
  PROVIDER_OLLAMA,
  WORD_LOOKUP_PROVIDER_YOUDAO,
} from "../shared/constants.js";
import { normalizeWord } from "../shared/word-learning.js";
import { lookupYoudao } from "../shared/youdao-api.js";
import {
  buildAiWordDefinitionPrompt,
  isUsableYoudaoWordResult,
  parseAiWordTranslations,
  resolveWordLookupAiProvider,
  YOUDAO_WORD_SOURCE_LABEL,
} from "../shared/word-lookup.js";
import { splitThinkingFromText } from "../shared/utils/textProcessing.js";
import {
  buildMissingCredentialError,
  normalizeRuntimeSettings,
  resolveProviderRuntime,
} from "./translationSettings.js";
import {
  runProviderCompletion,
  toProviderError,
} from "./translationProviders.js";

const wordLookupCache = new Map();
const WORD_LOOKUP_CACHE_TTL = 24 * 60 * 60 * 1000;

function getStoredSettings() {
  return chrome.storage.sync.get(null);
}

function getWordLookupCacheKey(word, settings) {
  const aiProvider = resolveWordLookupAiProvider(settings);
  const runtime = resolveProviderRuntime(settings, { provider: aiProvider });
  return [
    word,
    settings.wordLookupProvider,
    runtime.provider,
    runtime.selectedModel,
  ].join("|");
}

function getAiLookupError(runtime, settings) {
  if (runtime.provider === PROVIDER_OLLAMA && !runtime.selectedModel) {
    return "英语学习模型尚未选择。";
  }
  return buildMissingCredentialError(runtime, settings);
}

async function lookupWordWithAi(word, settings, options = {}) {
  const aiProvider = resolveWordLookupAiProvider(settings);
  const runtime = resolveProviderRuntime(settings, { provider: aiProvider });
  const configError = getAiLookupError(runtime, settings);
  if (configError) throw new Error(configError);

  let rawResponse = "";
  try {
    rawResponse = await (
      options.runProviderCompletionImpl || runProviderCompletion
    )({
      provider: runtime.provider,
      base: runtime.base,
      model: runtime.selectedModel,
      apiKey: runtime.apiKey,
      prompt: buildAiWordDefinitionPrompt(word),
      text: word,
      targetLang: "Chinese",
    });
  } catch (error) {
    throw new Error(toProviderError(runtime.provider, error));
  }

  const parsedResponse = splitThinkingFromText(rawResponse).translation;
  const translations = parseAiWordTranslations(parsedResponse);
  if (translations.length === 0) {
    throw new Error("AI 未返回可用的单词释义。");
  }

  return {
    word,
    responseWord: word,
    ukphone: "",
    usphone: "",
    phone: "",
    translations,
    provider: runtime.provider,
    model: runtime.selectedModel,
    sourceLabel: runtime.selectedModel || "AI",
    source: "ai",
    fallback: settings.wordLookupProvider === WORD_LOOKUP_PROVIDER_YOUDAO,
  };
}

export async function lookupWordWithConfiguredProvider(rawWord, options = {}) {
  const word = normalizeWord(rawWord);
  if (!word) throw new Error("无效的单词。");

  const storedSettings = options.settings || (await getStoredSettings());
  const settings = normalizeRuntimeSettings(storedSettings);

  if (settings.wordLookupProvider !== WORD_LOOKUP_PROVIDER_YOUDAO) {
    return lookupWordWithAi(word, settings, options);
  }

  let youdaoFailure = "有道未返回可用释义。";
  try {
    const youdaoResult = await (options.lookupYoudaoImpl || lookupYoudao)(word);
    if (isUsableYoudaoWordResult(word, youdaoResult)) {
      return {
        ...youdaoResult,
        provider: WORD_LOOKUP_PROVIDER_YOUDAO,
        model: YOUDAO_WORD_SOURCE_LABEL,
        sourceLabel: YOUDAO_WORD_SOURCE_LABEL,
        source: WORD_LOOKUP_PROVIDER_YOUDAO,
        fallback: false,
      };
    }
    youdaoFailure = youdaoResult?.responseWord
      ? `有道返回了不匹配词条“${youdaoResult.responseWord}”。`
      : "有道未返回可用释义。";
  } catch (error) {
    youdaoFailure = error?.message || String(error) || "有道查询失败。";
  }

  try {
    return await lookupWordWithAi(word, settings, options);
  } catch (error) {
    throw new Error(
      `${youdaoFailure} AI 回退失败：${error?.message || String(error)}`,
    );
  }
}

export async function lookupWordCached(rawWord, options = {}) {
  const word = normalizeWord(rawWord);
  if (!word) return { ok: false, error: "无效的单词。" };

  const storedSettings = options.settings || (await getStoredSettings());
  const settings = normalizeRuntimeSettings(storedSettings);
  const cacheKey = getWordLookupCacheKey(word, settings);
  const cached = wordLookupCache.get(cacheKey);
  if (cached && Date.now() - cached.at < WORD_LOOKUP_CACHE_TTL) {
    return { ok: true, ...cached.data, cached: true };
  }

  try {
    const data = await lookupWordWithConfiguredProvider(word, {
      ...options,
      settings,
    });
    wordLookupCache.set(cacheKey, { at: Date.now(), data });
    return { ok: true, ...data };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error) || "查询失败",
    };
  }
}

export function clearWordLookupCache() {
  wordLookupCache.clear();
}
