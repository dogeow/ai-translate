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
  DEFAULT_TRANSLATE_PROVIDER,
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
  DEFAULT_GITHUB_PAT,
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  GITHUB_AUTH_MODE_PAT,
  GITHUB_AUTH_MODE_DEVICE,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  DEFAULT_LEARNING_MODE_ENABLED,
} from "./constants.js";

/**
 * 默认设置值
 */
export const DEFAULT_SETTINGS = {
  provider: DEFAULT_TRANSLATE_PROVIDER,
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
  githubPat: DEFAULT_GITHUB_PAT,
  githubDeviceToken: DEFAULT_GITHUB_DEVICE_TOKEN,
  githubOAuthClientId: DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  githubModel: DEFAULT_GITHUB_MODEL,
  translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
  autoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
  hoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
  hoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  pageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  pageTranslateBatchChars: DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
};

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
  if (provider === PROVIDER_GITHUB_MODELS) {
    return PROVIDER_GITHUB_MODELS;
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

export function normalizeGitHubAuthMode(value) {
  return value === GITHUB_AUTH_MODE_DEVICE
    ? GITHUB_AUTH_MODE_DEVICE
    : GITHUB_AUTH_MODE_PAT;
}

export function resolveGitHubToken(input = {}) {
  const authMode = normalizeGitHubAuthMode(input.githubAuthMode);
  const pat = String(input.githubPat ?? DEFAULT_GITHUB_PAT).trim();
  const deviceToken = String(
    input.githubDeviceToken ?? DEFAULT_GITHUB_DEVICE_TOKEN,
  ).trim();

  if (authMode === GITHUB_AUTH_MODE_DEVICE) {
    return deviceToken || pat;
  }
  return pat || deviceToken;
}

export function getGitHubTokenLabel(input = {}) {
  return normalizeGitHubAuthMode(input.githubAuthMode) === GITHUB_AUTH_MODE_DEVICE
    ? "GitHub 设备登录令牌"
    : "GitHub PAT";
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

function resolveMiniMaxRegionFromInput(input = {}) {
  const provider = input.ollamaProvider;
  if (provider === PROVIDER_MINIMAX_GLOBAL) return MINIMAX_REGION_GLOBAL;
  if (provider === PROVIDER_MINIMAX_CN || provider === PROVIDER_MINIMAX) {
    return input.minimaxRegion
      ? normalizeMiniMaxRegion(input.minimaxRegion)
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
export function normalizeAllSettings(settings) {
  const rawProvider = settings.ollamaProvider;
  const ollamaProvider = normalizeTranslateProvider(
    rawProvider,
    settings.minimaxRegion,
  );
  const minimaxRegion = resolveMiniMaxRegionFromInput({
    ...settings,
    ollamaProvider,
  });
  const minimaxApiUrlRaw = String(settings.minimaxApiUrl || "").trim();
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
    ollamaProvider,
    minimaxRegion,
    minimaxApiUrl,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxApiKey: settings.minimaxApiKey,
  });
  const githubApiUrl = normalizeGitHubApiUrl(settings.githubApiUrl);
  const githubAuthMode = normalizeGitHubAuthMode(settings.githubAuthMode);
  const githubPat = String(settings.githubPat ?? DEFAULT_SETTINGS.githubPat).trim();
  const githubDeviceToken = String(
    settings.githubDeviceToken ?? DEFAULT_SETTINGS.githubDeviceToken,
  ).trim();
  const githubOAuthClientId = String(
    settings.githubOAuthClientId ?? DEFAULT_SETTINGS.githubOAuthClientId,
  ).trim();
  const githubToken = resolveGitHubToken({
    githubAuthMode,
    githubPat,
    githubDeviceToken,
  });

  return {
    ollamaProvider,
    ollamaUrl: (settings.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl).replace(
      /\/$/,
      "",
    ),
    ollamaModel: settings.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
    minimaxApiUrl,
    minimaxRegion,
    minimaxApiKey,
    minimaxApiKeyCn,
    minimaxApiKeyGlobal,
    minimaxModel: settings.minimaxModel || DEFAULT_SETTINGS.minimaxModel,
    githubApiUrl,
    githubAuthMode,
    githubPat,
    githubDeviceToken,
    githubOAuthClientId,
    githubToken,
    githubModel: settings.githubModel || DEFAULT_SETTINGS.githubModel,
    translateTargetLang:
      settings.translateTargetLang || DEFAULT_SETTINGS.translateTargetLang,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      settings.ollamaAutoTranslateMode,
      settings.ollamaAutoTranslateSelection,
    ),
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
