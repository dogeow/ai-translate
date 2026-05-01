/**
 * 全局共享常量
 * 所有模块应从此文件导入，避免重复定义
 */

// 翻译提供商（MiniMax 国内外在厂家层面区分）
export const PROVIDER_OLLAMA = "ollama";
export const PROVIDER_MINIMAX = "minimax"; // legacy
export const PROVIDER_MINIMAX_CN = "minimax-cn";
export const PROVIDER_MINIMAX_GLOBAL = "minimax-global";
export const PROVIDER_GITHUB_MODELS = "github-models";
export const PROVIDER_CHROME_AI = "chrome-ai";
export const DEFAULT_TRANSLATE_PROVIDER = PROVIDER_OLLAMA;

export const TRANSLATE_PROVIDER_OPTIONS = [
  { value: PROVIDER_OLLAMA, label: "Ollama（本地）" },
  { value: PROVIDER_MINIMAX_CN, label: "MiniMax（国内）" },
  { value: PROVIDER_MINIMAX_GLOBAL, label: "MiniMax（海外）" },
  { value: PROVIDER_GITHUB_MODELS, label: "GitHub Copilot" },
  { value: PROVIDER_CHROME_AI, label: "Chrome 内置 AI（免费 / 离线）" },
];

// Ollama 连接配置
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "";

// MiniMax 连接配置
export const DEFAULT_MINIMAX_API_URL_CN = "https://api.minimaxi.com/v1";
export const DEFAULT_MINIMAX_API_URL_GLOBAL = "https://api.minimax.io/v1";
export const DEFAULT_MINIMAX_API_URL = DEFAULT_MINIMAX_API_URL_CN;
export const DEFAULT_MINIMAX_API_KEY_CN = "";
export const DEFAULT_MINIMAX_API_KEY_GLOBAL = "";
export const MINIMAX_REGION_CN = "cn";
export const MINIMAX_REGION_GLOBAL = "global";
export const DEFAULT_MINIMAX_REGION = MINIMAX_REGION_CN;
export const MINIMAX_REGION_OPTIONS = [
  { value: MINIMAX_REGION_CN, label: "国内（minimaxi.com）" },
  { value: MINIMAX_REGION_GLOBAL, label: "海外（minimax.io）" },
];
// legacy: 保持兼容旧存储键 minimaxApiKey
export const DEFAULT_MINIMAX_API_KEY = DEFAULT_MINIMAX_API_KEY_CN;
export const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5-highspeed";
export const MINIMAX_MODEL_OPTIONS = [DEFAULT_MINIMAX_MODEL];

// GitHub Copilot 连接配置（底层仍使用 GitHub Models API）
export const DEFAULT_GITHUB_MODELS_API_URL = "https://models.github.ai";
export const GITHUB_AUTH_MODE_DEVICE = "device";
// PAT 模式已移除：仅保留设备登录（Copilot 订阅 + Device Flow）
export const DEFAULT_GITHUB_AUTH_MODE = GITHUB_AUTH_MODE_DEVICE;
export const DEFAULT_GITHUB_DEVICE_TOKEN = "";
export const DEFAULT_GITHUB_OAUTH_CLIENT_ID = "";
export const DEFAULT_GITHUB_MODEL = "openai/gpt-4.1";
// 仅向用户暴露真正稳定且设备登录可访问、配额相对合理的模型
export const GITHUB_MODEL_WHITELIST = Object.freeze([
  "openai/gpt-4.1",
  "openai/gpt-4o",
]);

// 翻译配置
export const DEFAULT_TRANSLATE_TARGET_LANG = "Chinese";
export const DEFAULT_AUTO_TRANSLATE_MODE = "hotkey";
export const DEFAULT_HOVER_TRANSLATE_SCOPE = "word";
export const DEFAULT_HOVER_TRANSLATE_DELAY_MS = 200;
export const DEFAULT_PAGE_TRANSLATE_CONCURRENCY = 1;
/** 页面翻译每批最少字符数，达到后不再继续加条；默认 128，用户可设置 */
export const DEFAULT_PAGE_TRANSLATE_BATCH_CHARS = 128;

// 自动翻译模式选项（统一定义，避免重复）
export const AUTO_TRANSLATE_MODE_OPTIONS = [
  {
    value: "hotkey",
    title: "热键翻译",
    shortTitle: "热键翻译", // popup 简洁版
    description: "仅保留手动快捷键、右键菜单和选区按钮。",
    hint: "只保留右键、快捷键和手动触发。",
  },
  {
    value: "selection",
    title: "双击 / 三击后翻译",
    shortTitle: "双击 / 三击", // popup 简洁版
    description: "双击单词或三击整段后自动翻译，适合基于选区的操作方式。",
    hint: "双击单词或三击整段后立即翻译。",
  },
  {
    value: "hover",
    title: "悬停自动翻译",
    shortTitle: "悬停翻译", // popup 简洁版
    description: "鼠标移动到文本上后自动翻译单词或整段，无需双击或按快捷键。",
    hint: "鼠标停留在文本上时自动触发翻译。",
  },
];

// 悬停翻译范围选项
export const HOVER_TRANSLATE_SCOPE_OPTIONS = [
  {
    value: "word",
    label: "只翻译单词",
    title: "只翻译单词",
    hint: "更轻量，适合看英文文章。",
  },
  {
    value: "paragraph",
    label: "翻译整段话",
    title: "翻译整段话",
    hint: "适合整段阅读和快速理解上下文。",
  },
];

// 功能开关
export const DEFAULT_LEARNING_MODE_ENABLED = false;
export const DEFAULT_APP_ENABLED = true;

// 内部配置
export const SELECTION_AUTO_TRANSLATE_DELAY_MS = 220;
export const DEFAULT_TRANSLATE_PENDING_UPDATE_INTERVAL_MS = 80;

// 存储键名
export const TRANSLATE_RESULT_KEY = "ollamaTranslateResult";
export const ALWAYS_TRANSLATE_ORIGINS_KEY = "alwaysTranslateOrigins";
export const TRANSLATION_CACHE_STORAGE_KEY = "ollamaTranslationCache";
export const TRANSLATION_CACHE_MAX_ENTRIES = 200;
export const AI_REQUEST_LOG_STORAGE_KEY = "ollamaAiRequestLogs";
export const AI_REQUEST_LOG_MAX_ENTRIES = 200;
export const SHORTCUTS_URL = "chrome://extensions/shortcuts";

export const LANG_OPTIONS = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
  { value: "Japanese", label: "日本語" },
  { value: "Korean", label: "한국어" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Spanish", label: "Español" },
];

export const TARGET_LANG_LABELS = Object.fromEntries(
  LANG_OPTIONS.map((option) => [option.value, option.label]),
);
