import {
  checkChromeAiAvailability,
  isChromeAiSupported,
} from "./chrome-ai-api.js";
import { PROVIDER_CHROME_AI } from "./constants.js";
import { normalizeAllSettings } from "./settings.js";

/**
 * Chrome AI 的可用性属于当前设备的运行时能力，不能只依赖同步设置中的
 * verifiedProviders。此检测只读取浏览器状态，不触发模型下载。
 */
export async function detectChromeAiRuntimeAvailability(
  settings = {},
  dependencies = {},
) {
  const normalized = normalizeAllSettings(settings);
  if (!normalized.addedProviders.includes(PROVIDER_CHROME_AI)) {
    return {
      checked: false,
      ready: false,
      status: null,
      error: null,
    };
  }

  const isSupported =
    dependencies.isSupported || isChromeAiSupported;
  const checkAvailability =
    dependencies.checkAvailability || checkChromeAiAvailability;

  if (!isSupported()) {
    return {
      checked: true,
      ready: false,
      status: { supported: false, translator: "unsupported" },
      error: null,
    };
  }

  try {
    const status = await checkAvailability(normalized.translateTargetLang);
    return {
      checked: true,
      ready:
        status?.supported !== false && status?.translator === "available",
      status,
      error: null,
    };
  } catch (error) {
    return {
      checked: true,
      ready: false,
      status: null,
      error,
    };
  }
}
