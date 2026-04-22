import { ORIGINS_PLATFORM_CONTENT } from "./constants.js";

export {
  formatModelSize,
  getSettingsSnapshot,
  getConfig,
  getStoredSettingsShape,
  getInitialSettings,
  runGenerateRequest,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchChars,
} from "./settings-utils.js";

export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform =
    navigator.userAgentData?.platform?.toLowerCase() ||
    (navigator.platform || "").toLowerCase();

  if (/win/.test(platform) || /win/.test(userAgent)) return "win";
  if (/linux/.test(platform) || /linux/.test(userAgent)) return "linux";
  return "macos";
}

export function getOrderedOriginsPlatforms() {
  const current = detectPlatform();
  return [
    current,
    ...Object.keys(ORIGINS_PLATFORM_CONTENT).filter((key) => key !== current),
  ];
}

export function formatShortcut(shortcut) {
  if (!shortcut) return "";
  return shortcut
    .replace(/^Alt\+/i, "Alt+")
    .replace(/^Ctrl\+/i, "Ctrl+")
    .replace(/^Command\+/i, "⌘+")
    .replace(/^MacCtrl\+/i, "Ctrl+");
}
