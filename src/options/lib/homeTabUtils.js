/**
 * HomeTab 组件的工具函数和常量
 * 提取重复逻辑和计算
 */

import {
  DEFAULT_MINIMAX_API_URL_CN,
  DEFAULT_MINIMAX_API_URL_GLOBAL,
  MINIMAX_REGION_GLOBAL,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
} from "../../shared/constants.js";
import {
  getMiniMaxRegionFromProvider,
  isMiniMaxProvider,
  normalizeMiniMaxRegion,
} from "../../shared/settings.js";

/**
 * 连接测试结果样式类
 */
const CONNECTION_RESULT_CLASSES = {
  ok: "test-result ok",
  err: "test-result err",
};

/**
 * 获取连接测试结果的样式类
 */
export function getConnectionResultClass(tone) {
  return CONNECTION_RESULT_CLASSES[tone] || "test-result";
}

/**
 * 计算 MiniMax 相关的配置（区域由厂家 minimax-cn / minimax-global 决定）
 */
export function getMiniMaxConfig(settings) {
  const region = isMiniMaxProvider(settings.provider)
    ? getMiniMaxRegionFromProvider(settings.provider)
    : normalizeMiniMaxRegion(settings.minimaxRegion);
  const isGlobal = region === MINIMAX_REGION_GLOBAL;

  return {
    region,
    isGlobal,
    urlPlaceholder: isGlobal
      ? DEFAULT_MINIMAX_API_URL_GLOBAL
      : DEFAULT_MINIMAX_API_URL_CN,
    apiKeyValue: isGlobal
      ? settings.minimaxApiKeyGlobal || ""
      : settings.minimaxApiKeyCn || "",
    apiKeyLabel: isGlobal
      ? "MiniMax 海外 API Key（minimax.io）"
      : "MiniMax 国内 API Key（minimaxi.com）",
  };
}

/**
 * 检查 MiniMax API Key 是否缺失
 */
export function isMiniMaxKeyMissing(settings) {
  if (!isMiniMaxProvider(settings.provider)) return false;

  const config = getMiniMaxConfig(settings);
  return !String(config.apiKeyValue || "").trim();
}

/**
 * 创建设置更新处理器
 * 返回一个函数用于更新设置并触发连接测试
 */
export function createSettingsUpdateHandler(
  updateSettings,
  settingsRef,
  updateConnectionStatus,
) {
  return (updates, connectionTestOptions = {}) => {
    const nextSettings = {
      ...settingsRef.current,
      ...updates,
    };
    updateSettings(() => nextSettings, "now");
    void updateConnectionStatus(nextSettings, {
      preserveTestMessage: false,
      ...connectionTestOptions,
    });
  };
}

/**
 * 处理提供商切换
 */
export function handleProviderChange(
  newProvider,
  settingsRef,
  updateSettings,
  updateConnectionStatus,
) {
  const handler = createSettingsUpdateHandler(
    updateSettings,
    settingsRef,
    updateConnectionStatus,
  );
  handler({ provider: newProvider });
}

/**
 * 处理 MiniMax 区域切换（仅兼容旧逻辑，新 UI 已在厂家切换时设置 region）
 */
export function handleMinimaxRegionChange(
  newRegion,
  settingsRef,
  updateSettings,
  updateConnectionStatus,
) {
  const normalizedRegion = normalizeMiniMaxRegion(newRegion);
  const nextApiUrl =
    normalizedRegion === MINIMAX_REGION_GLOBAL
      ? DEFAULT_MINIMAX_API_URL_GLOBAL
      : DEFAULT_MINIMAX_API_URL_CN;

  const nextSettings = {
    ...settingsRef.current,
    provider:
      normalizedRegion === MINIMAX_REGION_GLOBAL
        ? PROVIDER_MINIMAX_GLOBAL
        : PROVIDER_MINIMAX_CN,
    minimaxRegion: normalizedRegion,
    minimaxApiUrl: nextApiUrl,
  };

  const nextRegionKey = String(
    normalizedRegion === MINIMAX_REGION_GLOBAL
      ? nextSettings.minimaxApiKeyGlobal || ""
      : nextSettings.minimaxApiKeyCn || "",
  ).trim();

  updateSettings(() => nextSettings, "now");
  void updateConnectionStatus(nextSettings, {
    preserveTestMessage: false,
    suppressTestMessageOnMissingKey: !nextRegionKey,
  });
}

/**
 * 创建持久化设置的错误处理器
 */
export function createPersistErrorHandler(showAutoSaveStatus) {
  return (error) => {
    console.error("Save settings failed:", error);
    showAutoSaveStatus("自动保存失败", true);
  };
}
