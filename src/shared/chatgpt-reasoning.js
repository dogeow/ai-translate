export const CHATGPT_MODEL_CATALOG_KEY = "chatgptModelCatalog";

export const CHATGPT_REASONING_LABELS = Object.freeze({
  none: "无",
  minimal: "最低",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最高",
});

const FOUR_LEVELS = ["low", "medium", "high", "xhigh"];
const FIVE_LEVELS = [...FOUR_LEVELS, "max"];

// Used only until the account's Codex catalog supplies model capabilities.
const FALLBACK_REASONING = {
  "gpt-6-astra": [FIVE_LEVELS, "medium", true],
  "gpt-5.6-sol": [FIVE_LEVELS, "low", true],
  "gpt-5.6-terra": [FIVE_LEVELS, "medium", true],
  "gpt-5.6-luna": [FIVE_LEVELS, "medium", false],
  "gpt-5.5": [FOUR_LEVELS, "medium", false],
  "gpt-5.3-codex-spark": [FOUR_LEVELS, "high", false],
};

export function normalizeChatGptReasoningEffort(value) {
  const effort = String(value || "")
    .trim()
    .toLowerCase();
  return Object.hasOwn(CHATGPT_REASONING_LABELS, effort) ? effort : "";
}

export function parseChatGptReasoningInfo(model) {
  const levels = model?.supported_reasoning_levels;
  if (!Array.isArray(levels)) return {};
  const efforts = levels.map((level) =>
    typeof level === "string" ? level : level?.effort,
  );
  const supportedReasoningEfforts = [
    ...new Set(efforts.map(normalizeChatGptReasoningEffort).filter(Boolean)),
  ];
  const defaultEffort = normalizeChatGptReasoningEffort(
    model.default_reasoning_level,
  );
  return {
    supportedReasoningEfforts,
    defaultReasoningEffort: supportedReasoningEfforts.includes(defaultEffort)
      ? defaultEffort
      : "",
    // Ultra includes Codex orchestration; it is not a Responses effort value.
    supportsUltra: efforts.includes("ultra"),
  };
}

export function getChatGptReasoningInfo(model, modelInfo) {
  if (
    modelInfo?.name === model &&
    Array.isArray(modelInfo.supportedReasoningEfforts)
  ) {
    const efforts = modelInfo.supportedReasoningEfforts
      .map(normalizeChatGptReasoningEffort)
      .filter(Boolean);
    return {
      supportedReasoningEfforts: [...new Set(efforts)],
      defaultReasoningEffort: efforts.includes(modelInfo.defaultReasoningEffort)
        ? modelInfo.defaultReasoningEffort
        : "",
      supportsUltra: modelInfo.supportsUltra === true,
    };
  }
  const [efforts = [], defaultEffort = "", supportsUltra = false] =
    FALLBACK_REASONING[model] || [];
  return {
    supportedReasoningEfforts: [...efforts],
    defaultReasoningEffort: defaultEffort,
    supportsUltra,
  };
}

export function resolveChatGptReasoningEffort(model, value, modelInfo) {
  const effort = normalizeChatGptReasoningEffort(value);
  return getChatGptReasoningInfo(
    model,
    modelInfo,
  ).supportedReasoningEfforts.includes(effort)
    ? effort
    : "";
}

export async function readChatGptModelInfo(model) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return undefined;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(CHATGPT_MODEL_CATALOG_KEY, (stored) => {
        if (chrome.runtime?.lastError) return resolve(undefined);
        const catalog = stored?.[CHATGPT_MODEL_CATALOG_KEY];
        resolve(
          Array.isArray(catalog)
            ? catalog.find((item) => item.name === model)
            : undefined,
        );
      });
    } catch (_) {
      resolve(undefined);
    }
  });
}

export async function saveChatGptModelCatalog(catalog) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [CHATGPT_MODEL_CATALOG_KEY]: catalog }, () => {
        void chrome.runtime?.lastError;
        resolve();
      });
    } catch (_) {
      resolve();
    }
  });
}
