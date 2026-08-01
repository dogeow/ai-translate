// 从共享模块重新导出，保持向后兼容
export {
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_GITHUB_MODELS,
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
  DEFAULT_TRANSLATE_PROVIDER,
  TRANSLATE_PROVIDER_OPTIONS,
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
  MINIMAX_REGION_OPTIONS,
  DEFAULT_MINIMAX_MODEL,
  MINIMAX_MODEL_OPTIONS,
  DEFAULT_GITHUB_MODELS_API_URL,
  GITHUB_AUTH_MODE_DEVICE,
  DEFAULT_GITHUB_AUTH_MODE,
  DEFAULT_GITHUB_DEVICE_TOKEN,
  DEFAULT_GITHUB_OAUTH_CLIENT_ID,
  DEFAULT_GITHUB_MODEL,
  GITHUB_MODEL_WHITELIST,
  DEFAULT_CHATGPT_CODEX_API_URL,
  DEFAULT_CHATGPT_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_MODIFIER_KEY,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_CHARS,
  DEFAULT_LEARNING_MODE_ENABLED,
  TRANSLATE_RESULT_KEY,
  TRANSLATION_CACHE_STORAGE_KEY,
  TRANSLATION_CACHE_MAX_ENTRIES,
  AI_REQUEST_LOG_STORAGE_KEY,
  AI_REQUEST_LOG_MAX_ENTRIES,
  SHORTCUTS_URL,
  LANG_OPTIONS,
  TARGET_LANG_LABELS,
} from "../../shared/constants.js";

// 扩展 origin 模式常量
const EXTENSION_ORIGIN_CHROME = "chrome-extension://*";
const EXTENSION_ORIGIN_ALL =
  "chrome-extension://*,moz-extension://*,safari-web-extension://*";

export const ORIGINS_PLATFORM_CONTENT = {
  macos: {
    label: "macOS",
    blocks: [
      {
        type: "hint",
        text: (
          <>
            官方推荐用 <code>launchctl setenv</code> 设置环境变量，然后
            <strong>完全退出并重新打开 Ollama App</strong>。
          </>
        ),
      },
      {
        type: "sub",
        text: "仅 Chrome 扩展",
      },
      {
        type: "code",
        text: 'launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"',
      },
      {
        type: "sub",
        text: "Chrome + Firefox + Safari 扩展",
      },
      {
        type: "code",
        text: 'launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*,safari-web-extension://*"',
      },
      {
        type: "link",
        text: "参考：Ollama FAQ - Setting environment variables on Mac",
        href: "https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-mac",
      },
    ],
  },
  win: {
    label: "Windows",
    blocks: [
      {
        type: "hint",
        text: (
          <>
            Ollama 会读取用户/系统环境变量。在
            <strong>系统环境变量</strong>中新增：
          </>
        ),
      },
      {
        type: "code",
        text: "OLLAMA_ORIGINS=chrome-extension://*",
      },
      {
        type: "hint",
        text: (
          <>
            如需支持 Firefox：
            <code>
              OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-web-extension://*
            </code>
          </>
        ),
      },
      {
        type: "hint",
        text: (
          <>
            然后<strong>退出 Ollama</strong>，再从开始菜单重新打开。
          </>
        ),
      },
      {
        type: "link",
        text: "参考：Ollama FAQ - Setting environment variables on Windows",
        href: "https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-windows",
      },
    ],
  },
  linux: {
    label: "Linux",
    blocks: [
      {
        type: "hint",
        text: (
          <>
            若使用 systemd 管理 Ollama 服务，在服务配置的 <code>[Service]</code>{" "}
            下增加：
          </>
        ),
      },
      {
        type: "code",
        text: 'Environment="OLLAMA_ORIGINS=chrome-extension://*"',
      },
      {
        type: "hint",
        text: "然后执行：",
      },
      {
        type: "code",
        text: "systemctl daemon-reload\nsystemctl restart ollama",
      },
      {
        type: "link",
        text: "参考：Ollama FAQ - Setting environment variables on Linux",
        href: "https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-linux",
      },
    ],
  },
};
