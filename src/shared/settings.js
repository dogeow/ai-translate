/**
 * 设置规范化统一模块
 * 提供设置默认值和规范化函数
 * 所有模块应从此处导入规范化函数，确保逻辑一致
 */

import {
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_GITHUB_MODELS,
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_WORD_LOOKUP_PROVIDER,
  WORD_LOOKUP_PROVIDER_YOUDAO,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_API_URL_CN,
  DEFAULT_MINIMAX_API_URL_GLOBAL,
  DEFAULT_MINIMAX_API_KEY,
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
  DEFAULT_CHATGPT_MODEL,
  DEPRECATED_CHATGPT_MODELS,
  GITHUB_AUTH_MODE_DEVICE,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_MODIFIER_KEY,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  DEFAULT_LEARNING_MODE_ENABLED,
  DEFAULT_APP_ENABLED,
} from "./constants.js";

/**
 * 默认设置值
 */
export const DEFAULT_SETTINGS = {
  provider: DEFAULT_TRANSLATE_PROVIDER,
  uiRewriteProvider: DEFAULT_TRANSLATE_PROVIDER,
  learningProvider: DEFAULT_TRANSLATE_PROVIDER,
  wordLookupProvider: DEFAULT_WORD_LOOKUP_PROVIDER,
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
  autoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
  hoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
  hoverTranslateModifierKey: DEFAULT_HOVER_TRANSLATE_MODIFIER_KEY,
  hoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  pageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  pageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
};

export const CANONICAL_SETTINGS_KEY_MAP = Object.freeze({
  provider: "ollamaProvider",
  autoTranslateMode: "ollamaAutoTranslateMode",
  hoverTranslateScope: "ollamaHoverTranslateScope",
  hoverTranslateModifierKey: "ollamaHoverTranslateModifierKey",
  hoverTranslateDelayMs: "ollamaHoverTranslateDelayMs",
  pageTranslateConcurrency: "ollamaPageTranslateConcurrency",
  pageTranslateBatchChars: "ollamaPageTranslateBatchChars",
});

export const CANONICAL_SETTINGS_KEYS = Object.freeze(
  Object.keys(CANONICAL_SETTINGS_KEY_MAP),
);

export const POPUP_SETTINGS_STORAGE_DEFAULTS = Object.freeze({
  provider: DEFAULT_SETTINGS.provider,
  uiRewriteProvider: DEFAULT_SETTINGS.uiRewriteProvider,
  learningProvider: DEFAULT_SETTINGS.learningProvider,
  wordLookupProvider: DEFAULT_SETTINGS.wordLookupProvider,
  autoTranslateMode: DEFAULT_SETTINGS.autoTranslateMode,
  hoverTranslateScope: DEFAULT_SETTINGS.hoverTranslateScope,
  hoverTranslateModifierKey: DEFAULT_SETTINGS.hoverTranslateModifierKey,
  minimaxRegion: DEFAULT_SETTINGS.minimaxRegion,
  appEnabled: DEFAULT_APP_ENABLED,
});

const CANONICAL_PROVIDER_VALUES = new Set([
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_GITHUB_MODELS,
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
]);

export function normalizeAddedProviders(value, activeProvider) {
  const source = Array.isArray(value) ? value : [];
  const explicitlyEmpty = Array.isArray(value) && value.length === 0;
  const normalizedActiveProvider = normalizeTranslateProvider(activeProvider);
  const providers = source
    .map((provider) => String(provider || "").trim())
    .filter((provider) => CANONICAL_PROVIDER_VALUES.has(provider))
    .map((provider) => normalizeTranslateProvider(provider));

  if (!explicitlyEmpty && !providers.includes(normalizedActiveProvider)) {
    providers.unshift(normalizedActiveProvider);
  }

  return Array.from(new Set(providers));
}

export function normalizeVerifiedProviders(value, addedProviders = []) {
  const added = new Set(
    Array.isArray(addedProviders) ? addedProviders : [],
  );
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((provider) => String(provider || "").trim())
        .filter(
          (provider) =>
            CANONICAL_PROVIDER_VALUES.has(provider) && added.has(provider),
        )
        .map((provider) => normalizeTranslateProvider(provider)),
    ),
  );
}

export function normalizeFeatureProvider(
  value,
  fallbackProvider = DEFAULT_SETTINGS.provider,
  addedProviders = null,
) {
  const normalizedFallback = normalizeTranslateProvider(fallbackProvider);
  const raw = String(value || "").trim();
  const normalized = CANONICAL_PROVIDER_VALUES.has(raw)
    ? normalizeTranslateProvider(raw)
    : normalizedFallback;

  if (!Array.isArray(addedProviders) || addedProviders.length === 0) {
    return normalized;
  }
  if (addedProviders.includes(normalized)) return normalized;
  if (addedProviders.includes(normalizedFallback)) return normalizedFallback;
  return addedProviders[0];
}

export function normalizeWordLookupProvider(value, addedProviders = null) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === WORD_LOOKUP_PROVIDER_YOUDAO) {
    return WORD_LOOKUP_PROVIDER_YOUDAO;
  }
  if (!CANONICAL_PROVIDER_VALUES.has(raw)) {
    return WORD_LOOKUP_PROVIDER_YOUDAO;
  }

  const normalized = normalizeTranslateProvider(raw);
  if (
    Array.isArray(addedProviders) &&
    addedProviders.length > 0 &&
    !addedProviders.includes(normalized)
  ) {
    return WORD_LOOKUP_PROVIDER_YOUDAO;
  }
  return normalized;
}

function hasOwnSetting(input, key) {
  return !!input && Object.prototype.hasOwnProperty.call(input, key);
}

function readSettingValue(input, key, options = {}) {
  const { allowLegacy = false } = options;
  if (hasOwnSetting(input, key)) {
    return input[key];
  }
  if (!allowLegacy) {
    return undefined;
  }
  const legacyKey = CANONICAL_SETTINGS_KEY_MAP[key];
  if (legacyKey && hasOwnSetting(input, legacyKey)) {
    return input[legacyKey];
  }
  return undefined;
}

function pickStoredOrDefault(input, key, defaultValue, options = {}) {
  const value = readSettingValue(input, key, options);
  return value ?? defaultValue;
}

function hasLegacySetting(input, key) {
  const legacyKey = CANONICAL_SETTINGS_KEY_MAP[key];
  if (legacyKey && hasOwnSetting(input, legacyKey)) {
    return true;
  }
  return key === "autoTranslateMode" && hasOwnSetting(input, "ollamaAutoTranslateSelection");
}

function isValidCanonicalSetting(key, value) {
  if (value == null) return false;

  if (key === "provider") {
    return CANONICAL_PROVIDER_VALUES.has(String(value || "").trim());
  }

  if (key === "autoTranslateMode") {
    return value === "selection" || value === "hover" || value === "hotkey";
  }

  if (key === "hoverTranslateScope") {
    return value === "word" || value === "paragraph";
  }

  if (key === "hoverTranslateModifierKey") {
    return ["alt", "shift", "control", "meta", "none"].includes(value);
  }

  if (key === "hoverTranslateDelayMs") {
    const number = Number(value);
    return Number.isFinite(number) && normalizeHoverTranslateDelayMs(value) === number;
  }

  if (key === "pageTranslateConcurrency") {
    const number = Number(value);
    return Number.isFinite(number) && normalizePageTranslateConcurrency(value) === number;
  }

  if (key === "pageTranslateBatchChars") {
    const number = Number(value);
    return Number.isFinite(number) && normalizePageTranslateBatchChars(value) === number;
  }

  return true;
}

function buildLegacyPreferredInput(stored = {}) {
  const input = { ...stored };

  CANONICAL_SETTINGS_KEYS.forEach((key) => {
    if (!hasOwnSetting(input, key)) {
      return;
    }
    if (!hasLegacySetting(input, key)) {
      return;
    }
    if (isValidCanonicalSetting(key, input[key])) {
      return;
    }
    delete input[key];
  });

  return input;
}

/**
 * 是否为 MiniMax 系厂家（含国内/海外及旧版 minimax）
 * @param {string} provider
 * @returns {boolean}
 */
export function isMiniMaxProvider(provider) {
  return (
    provider === PROVIDER_MINIMAX ||
    provider === PROVIDER_MINIMAX_CN ||
    provider === PROVIDER_MINIMAX_GLOBAL
  );
}

export function isGitHubModelsProvider(provider) {
  return provider === PROVIDER_GITHUB_MODELS;
}

export function isChatGptProvider(provider) {
  return provider === PROVIDER_CHATGPT;
}

/**
 * 规范化 ChatGPT 模型：空值回落默认值，已下线模型迁移到当前默认。
 */
export function normalizeChatGptModel(value) {
  const model = String(value || "").trim();
  if (!model) return DEFAULT_CHATGPT_MODEL;
  if (DEPRECATED_CHATGPT_MODELS.includes(model)) {
    return DEFAULT_CHATGPT_MODEL;
  }
  return model;
}


export function isChromeAiProvider(provider) {
  return provider === PROVIDER_CHROME_AI;
}

/**
 * 从厂家值得到 MiniMax 区域（仅当 isMiniMaxProvider 为 true 时有效）
 * @param {string} provider
 * @returns {string} MINIMAX_REGION_CN | MINIMAX_REGION_GLOBAL
 */
export function getMiniMaxRegionFromProvider(provider) {
  return provider === PROVIDER_MINIMAX_GLOBAL
    ? MINIMAX_REGION_GLOBAL
    : MINIMAX_REGION_CN;
}

/**
 * 规范化翻译提供商
 * 旧版单一 "minimax" 根据 minimaxRegion 转为 minimax-cn / minimax-global
 * @param {string} provider - 提供商
 * @param {string} [minimaxRegion] - 仅当 provider 为 legacy "minimax" 时用于解析
 * @returns {string} 规范化后的提供商：'ollama' | 'minimax-cn' | 'minimax-global'
 */
export function normalizeTranslateProvider(provider, minimaxRegion) {
  if (provider === PROVIDER_CHROME_AI) {
    return PROVIDER_CHROME_AI;
  }
  if (provider === PROVIDER_GITHUB_MODELS) {
    return PROVIDER_GITHUB_MODELS;
  }
  if (provider === PROVIDER_CHATGPT) {
    return PROVIDER_CHATGPT;
  }
  if (
    provider === PROVIDER_MINIMAX_CN ||
    provider === PROVIDER_MINIMAX_GLOBAL
  ) {
    return provider;
  }
  if (provider === PROVIDER_MINIMAX) {
    return normalizeMiniMaxRegion(minimaxRegion) === MINIMAX_REGION_GLOBAL
      ? PROVIDER_MINIMAX_GLOBAL
      : PROVIDER_MINIMAX_CN;
  }
  return PROVIDER_OLLAMA;
}

export function normalizeGitHubApiUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_GITHUB_MODELS_API_URL;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

export function normalizeGitHubAuthMode(_value) {
  // 仅支持设备登录
  return GITHUB_AUTH_MODE_DEVICE;
}

export function resolveGitHubToken(input = {}) {
  return String(input.githubDeviceToken ?? DEFAULT_GITHUB_DEVICE_TOKEN).trim();
}

export function getGitHubTokenLabel() {
  return "GitHub 设备登录令牌";
}

export function getGitHubDeviceLoginPrompt(input = {}) {
  const clientId = String(input.githubOAuthClientId ?? "").trim();
  return clientId
    ? "请先完成 GitHub Copilot 设备登录。"
    : "请先填写 GitHub OAuth App Client ID，并完成 GitHub Copilot 设备登录。";
}

/**
 * 规范化 MiniMax API 地址
 * @param {string} value - API 地址
 * @returns {string}
 */
export function normalizeMiniMaxApiUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_SETTINGS.minimaxApiUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

export function normalizeMiniMaxRegion(value) {
  return value === MINIMAX_REGION_GLOBAL
    ? MINIMAX_REGION_GLOBAL
    : MINIMAX_REGION_CN;
}

export function getDefaultMiniMaxApiUrlByRegion(region) {
  return normalizeMiniMaxRegion(region) === MINIMAX_REGION_GLOBAL
    ? DEFAULT_MINIMAX_API_URL_GLOBAL
    : DEFAULT_MINIMAX_API_URL_CN;
}

/**
 * 判断 MiniMax API 地址是否为海外域名（minimax.io）
 * @param {string} value
 * @returns {boolean}
 */
export function isMiniMaxGlobalApiUrl(value) {
  const normalized = normalizeMiniMaxApiUrl(value);
  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return hostname === "minimax.io" || hostname.endsWith(".minimax.io");
  } catch (_) {
    return false;
  }
}

function resolveMiniMaxRegionFromInput(input = {}, options = {}) {
  const provider = pickStoredOrDefault(
    input,
    "provider",
    DEFAULT_SETTINGS.provider,
    options,
  );
  if (provider === PROVIDER_MINIMAX_GLOBAL) return MINIMAX_REGION_GLOBAL;
  if (provider === PROVIDER_MINIMAX_CN) return MINIMAX_REGION_CN;
  if (provider === PROVIDER_MINIMAX) {
    if (input.minimaxRegion) {
      return normalizeMiniMaxRegion(input.minimaxRegion);
    }
    return isMiniMaxGlobalApiUrl(input.minimaxApiUrl)
      ? MINIMAX_REGION_GLOBAL
      : MINIMAX_REGION_CN;
  }
  if (input.minimaxRegion) {
    return normalizeMiniMaxRegion(input.minimaxRegion);
  }
  return isMiniMaxGlobalApiUrl(input.minimaxApiUrl)
    ? MINIMAX_REGION_GLOBAL
    : MINIMAX_REGION_CN;
}

/**
 * 根据当前 MiniMax API 地址选择对应 API Key（海外/国内）
 * 兼容旧版 minimaxApiKey 作为兜底。
 * @param {object} input
 * @param {string} input.minimaxApiUrl
 * @param {string} [input.minimaxApiKeyCn]
 * @param {string} [input.minimaxApiKeyGlobal]
 * @param {string} [input.minimaxApiKey] - 旧字段
 * @returns {string}
 */
export function resolveMiniMaxApiKey(input = {}) {
  const region = resolveMiniMaxRegionFromInput(input);
  const cnKey = String(
    input.minimaxApiKeyCn ?? input.minimaxApiKey ?? DEFAULT_MINIMAX_API_KEY_CN,
  ).trim();
  const globalKey = String(
    input.minimaxApiKeyGlobal ??
      input.minimaxApiKey ??
      DEFAULT_MINIMAX_API_KEY_GLOBAL,
  ).trim();
  const legacyKey = String(
    input.minimaxApiKey ?? DEFAULT_MINIMAX_API_KEY,
  ).trim();

  if (region === MINIMAX_REGION_GLOBAL) {
    return globalKey || legacyKey;
  }
  return cnKey || legacyKey;
}

export function getMiniMaxApiKeyLabel(input) {
  const region =
    typeof input === "string"
      ? isMiniMaxGlobalApiUrl(input)
        ? MINIMAX_REGION_GLOBAL
        : MINIMAX_REGION_CN
      : resolveMiniMaxRegionFromInput(input || {});

  return region === MINIMAX_REGION_GLOBAL
    ? "MiniMax 海外 API Key（minimax.io）"
    : "MiniMax 国内 API Key（minimaxi.com）";
}

/**
 * 规范化自动翻译模式
 * @param {string} mode - 翻译模式
 * @param {boolean} legacySelection - 兼容旧版 selection 设置
 * @returns {string} 规范化后的模式：'selection' | 'hover' | 'hotkey'
 */
export function normalizeAutoTranslateMode(mode, legacySelection = false) {
  if (mode === "selection" || mode === "hover" || mode === "hotkey")
    return mode;
  return legacySelection ? "selection" : DEFAULT_SETTINGS.autoTranslateMode;
}

/**
 * 规范化悬停翻译范围
 * @param {string} scope - 翻译范围
 * @returns {string} 规范化后的范围：'word' | 'paragraph'
 */
export function normalizeHoverTranslateScope(scope) {
  return scope === "paragraph"
    ? "paragraph"
    : DEFAULT_SETTINGS.hoverTranslateScope;
}

/**
 * 规范化悬停范围临时切换键
 * @param {string} key - 'alt' | 'shift' | 'control' | 'meta' | 'none'
 * @returns {string}
 */
export function normalizeHoverTranslateModifierKey(key) {
  return ["alt", "shift", "control", "meta", "none"].includes(key)
    ? key
    : DEFAULT_SETTINGS.hoverTranslateModifierKey;
}

/**
 * 规范化悬停翻译延迟时间
 * @param {string|number} value - 延迟毫秒数
 * @returns {number} 规范化后的延迟时间（0-5000ms）
 */
export function normalizeHoverTranslateDelayMs(value) {
  if (value === "" || value == null)
    return DEFAULT_SETTINGS.hoverTranslateDelayMs;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SETTINGS.hoverTranslateDelayMs;
  return Math.min(5000, Math.max(0, Math.round(number)));
}

/**
 * 规范化页面翻译并发数
 * @param {string|number} value
 * @returns {number} 1-8
 */
export function normalizePageTranslateConcurrency(value) {
  if (value === "" || value == null)
    return DEFAULT_SETTINGS.pageTranslateConcurrency;
  const number = Number(value);
  if (!Number.isFinite(number))
    return DEFAULT_SETTINGS.pageTranslateConcurrency;
  return Math.min(8, Math.max(1, Math.round(number)));
}

/**
 * 规范化页面翻译批量字符数（每批累计文字达到该长度后不再加条）
 * @param {string|number} value
 * @returns {number} 32-2048，默认 128
 */
export function normalizePageTranslateBatchChars(value) {
  if (value === "" || value == null)
    return DEFAULT_SETTINGS.pageTranslateBatchChars;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SETTINGS.pageTranslateBatchChars;
  return Math.min(2048, Math.max(32, Math.round(number)));
}

/**
 * 规范化所有设置
 * @param {object} settings - 原始设置对象
 * @returns {object} 规范化后的设置对象
 */
function normalizeSettings(settings = {}, options = {}) {
  const { allowLegacy = false } = options;
  const rawProvider = pickStoredOrDefault(
    settings,
    "provider",
    DEFAULT_SETTINGS.provider,
    { allowLegacy },
  );
  const inferredMiniMaxRegion = resolveMiniMaxRegionFromInput(settings, {
    allowLegacy,
  });
  const provider = normalizeTranslateProvider(
    rawProvider,
    inferredMiniMaxRegion,
  );
  const addedProviders = normalizeAddedProviders(
    settings.addedProviders,
    provider,
  );
  const verifiedProviders = normalizeVerifiedProviders(
    settings.verifiedProviders,
    addedProviders,
  );
  const uiRewriteProvider = normalizeFeatureProvider(
    settings.uiRewriteProvider,
    provider,
    addedProviders,
  );
  const learningProvider = normalizeFeatureProvider(
    settings.learningProvider,
    provider,
    addedProviders,
  );
  const wordLookupProvider = normalizeWordLookupProvider(
    settings.wordLookupProvider,
    addedProviders,
  );
  const minimaxRegion = resolveMiniMaxRegionFromInput({
    ...settings,
    provider,
  }, { allowLegacy });
  const minimaxApiUrlRaw = String(
    settings?.minimaxApiUrl ?? DEFAULT_SETTINGS.minimaxApiUrl,
  ).trim();
  const minimaxApiUrl = minimaxApiUrlRaw
    ? normalizeMiniMaxApiUrl(minimaxApiUrlRaw)
    : getDefaultMiniMaxApiUrlByRegion(minimaxRegion);
  const minimaxApiKeyCn = String(
    settings.minimaxApiKeyCn ??
      settings.minimaxApiKey ??
      DEFAULT_SETTINGS.minimaxApiKeyCn,
  ).trim();
  const minimaxApiKeyGlobal = String(
    settings.minimaxApiKeyGlobal ??
      settings.minimaxApiKey ??
      DEFAULT_SETTINGS.minimaxApiKeyGlobal,
  ).trim();
  const minimaxApiKey = resolveMiniMaxApiKey({
    provider,
    minimaxRegion,
    minimaxApiUrl,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxApiKey: settings.minimaxApiKey,
  });
  const githubApiUrl = normalizeGitHubApiUrl(settings.githubApiUrl);
  const githubAuthMode = normalizeGitHubAuthMode(settings.githubAuthMode);
  const githubDeviceToken = String(
    settings.githubDeviceToken ?? DEFAULT_SETTINGS.githubDeviceToken,
  ).trim();
  const githubOAuthClientId = String(
    settings.githubOAuthClientId ?? DEFAULT_SETTINGS.githubOAuthClientId,
  ).trim();
  const githubToken = resolveGitHubToken({
    githubAuthMode,
    githubDeviceToken,
  });

  return {
    provider,
    uiRewriteProvider,
    learningProvider,
    wordLookupProvider,
    addedProviders,
    verifiedProviders,
    ollamaUrl: String(
      settings?.ollamaUrl ?? DEFAULT_SETTINGS.ollamaUrl,
    ).replace(/\/$/, ""),
    ollamaModel:
      settings?.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
    minimaxApiUrl,
    minimaxRegion,
    minimaxApiKey,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxModel:
      settings?.minimaxModel || DEFAULT_SETTINGS.minimaxModel,
    githubApiUrl,
    githubAuthMode,
    githubDeviceToken,
    githubOAuthClientId,
    githubToken,
    githubModel: settings?.githubModel || DEFAULT_SETTINGS.githubModel,
    chatgptModel: normalizeChatGptModel(settings?.chatgptModel),
    translateTargetLang:
      settings?.translateTargetLang || DEFAULT_SETTINGS.translateTargetLang,
    autoTranslateMode: normalizeAutoTranslateMode(
      readSettingValue(settings, "autoTranslateMode", { allowLegacy }),
      allowLegacy ? settings?.ollamaAutoTranslateSelection : false,
    ),
    hoverTranslateScope: normalizeHoverTranslateScope(
      readSettingValue(settings, "hoverTranslateScope", { allowLegacy }),
    ),
    hoverTranslateModifierKey: normalizeHoverTranslateModifierKey(
      readSettingValue(settings, "hoverTranslateModifierKey", { allowLegacy }),
    ),
    hoverTranslateDelayMs: normalizeHoverTranslateDelayMs(
      readSettingValue(settings, "hoverTranslateDelayMs", { allowLegacy }),
    ),
    pageTranslateConcurrency: normalizePageTranslateConcurrency(
      readSettingValue(settings, "pageTranslateConcurrency", { allowLegacy }),
    ),
    pageTranslateBatchChars: normalizePageTranslateBatchChars(
      readSettingValue(settings, "pageTranslateBatchChars", { allowLegacy }),
    ),
    learningModeEnabled: !!settings?.learningModeEnabled,
  };
}

export function normalizeAllSettings(settings = {}) {
  return normalizeSettings(settings, { allowLegacy: false });
}

function normalizeLegacySettings(settings = {}) {
  return normalizeSettings(settings, { allowLegacy: true });
}

export function buildSettingsMigration(stored = {}) {
  const canonicalNormalized = normalizeAllSettings(stored);
  const legacyNormalized = normalizeLegacySettings(
    buildLegacyPreferredInput(stored),
  );
  const nextSettings = {};

  CANONICAL_SETTINGS_KEYS.forEach((key) => {
    const normalizedValue = canonicalNormalized[key];
    const hasCanonical = hasOwnSetting(stored, key);
    const hasLegacy = hasLegacySetting(stored, key);
    const shouldPreferLegacy =
      hasLegacy &&
      (!hasCanonical || !isValidCanonicalSetting(key, stored[key]));
    const targetValue = shouldPreferLegacy
      ? legacyNormalized[key]
      : normalizedValue;
    const canonicalNeedsNormalize =
      hasCanonical && stored[key] !== targetValue;
    const legacyNeedsMigration =
      hasLegacy && (!hasCanonical || stored[key] !== targetValue);

    if (canonicalNeedsNormalize || legacyNeedsMigration) {
      nextSettings[key] = targetValue;
    }
  });

  return {
    shouldMigrate: Object.keys(nextSettings).length > 0,
    nextSettings,
  };
}

export async function migrateSettingsIfNeeded(readSettings, writeSettings) {
  const stored = await readSettings();
  const migration = buildSettingsMigration(stored);
  const settings = migration.shouldMigrate
    ? { ...stored, ...migration.nextSettings }
    : stored;

  if (migration.shouldMigrate) {
    try {
      await writeSettings(migration.nextSettings);
    } catch (error) {
      return {
        ...migration,
        settings,
        writeFailed: true,
        error,
      };
    }
  }

  return {
    ...migration,
    settings,
    writeFailed: false,
    error: null,
  };
}

export function getPopupSettingsState(stored = {}) {
  const normalized = normalizeAllSettings(stored);

  return {
    provider: normalized.provider,
    uiRewriteProvider: normalized.uiRewriteProvider,
    learningProvider: normalized.learningProvider,
    wordLookupProvider: normalized.wordLookupProvider,
    autoTranslateMode: normalized.autoTranslateMode,
    hoverTranslateScope: normalized.hoverTranslateScope,
    hoverTranslateModifierKey: normalized.hoverTranslateModifierKey,
    learningModeEnabled: normalized.learningModeEnabled,
    appEnabled: stored.appEnabled !== false,
  };
}
