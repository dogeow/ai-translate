/**
 * AI 页面 UI 改造 - 存储与版本管理
 * 数据存于 chrome.storage.local，避免 sync 配额限制。
 *
 * 数据形状：
 * UI_REWRITES_STORAGE_KEY -> {
 *   rewrites: [
 *     {
 *       id: string,                 // 改造规则 id
 *       label: string,              // 显示名（默认取 origin 或 host）
 *       urlPattern: string,         // 简单通配符（* 匹配任意字符）
 *       activeVersionId: string,    // "original" 或 versions[i].id
 *       versions: [
 *         {
 *           id: string,
 *           label: string,           // "版本 1" 等
 *           prompt: string,          // 用户输入的提示词
 *           css: string,             // AI 生成的 CSS
 *           createdAt: number,
 *           model: string,           // 生成时使用的模型名（可选）
 *           provider: string,        // 生成时使用的 provider（可选）
 *         }
 *       ],
 *       createdAt: number,
 *       updatedAt: number,
 *     }
 *   ]
 * }
 */

export const UI_REWRITES_STORAGE_KEY = "uiRewrites";
export const UI_REWRITE_ORIGINAL_VERSION = "original";

function getLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (value) => resolve(value || {}));
  });
}

function setLocal(updates) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export async function loadAllUiRewrites() {
  const stored = await getLocal(UI_REWRITES_STORAGE_KEY);
  const data = stored[UI_REWRITES_STORAGE_KEY];
  if (!data || !Array.isArray(data.rewrites)) {
    return [];
  }
  return data.rewrites.filter((rule) => rule && typeof rule === "object");
}

export async function saveAllUiRewrites(rewrites) {
  await setLocal({
    [UI_REWRITES_STORAGE_KEY]: {
      rewrites: Array.isArray(rewrites) ? rewrites : [],
    },
  });
}

function genId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * 将简单通配符（*）模式转换为正则。
 */
export function compileUrlPattern(pattern) {
  if (!pattern || typeof pattern !== "string") return null;
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  try {
    return new RegExp(`^${escaped}$`, "i");
  } catch (_) {
    return null;
  }
}

export function matchUrlPattern(url, pattern) {
  if (!url) return false;
  const re = compileUrlPattern(pattern);
  if (!re) return false;
  return re.test(url);
}

export function defaultPatternForUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return "";
    return `${u.protocol}//${u.host}/*`;
  } catch (_) {
    return "";
  }
}

export function defaultLabelForUrl(url) {
  try {
    const u = new URL(url);
    return u.host;
  } catch (_) {
    return url || "未命名";
  }
}

export async function findUiRewriteForUrl(url) {
  if (!url) return null;
  const rewrites = await loadAllUiRewrites();
  for (const rule of rewrites) {
    if (matchUrlPattern(url, rule.urlPattern)) {
      return rule;
    }
  }
  return null;
}

export function getActiveCss(rule) {
  if (!rule) return "";
  if (
    !rule.activeVersionId ||
    rule.activeVersionId === UI_REWRITE_ORIGINAL_VERSION
  ) {
    return "";
  }
  const version = (rule.versions || []).find(
    (v) => v.id === rule.activeVersionId,
  );
  return version?.css || "";
}

export async function upsertUiRewriteVersion({
  url,
  prompt,
  css,
  provider,
  model,
}) {
  const rewrites = await loadAllUiRewrites();
  let rule = rewrites.find((r) => matchUrlPattern(url, r.urlPattern));
  const now = Date.now();
  const newVersion = {
    id: genId("ver"),
    label: "",
    prompt: String(prompt || "").trim(),
    css: String(css || "").trim(),
    createdAt: now,
    provider: provider || "",
    model: model || "",
  };
  if (!rule) {
    rule = {
      id: genId("rw"),
      label: defaultLabelForUrl(url),
      urlPattern: defaultPatternForUrl(url) || url,
      activeVersionId: newVersion.id,
      versions: [newVersion],
      createdAt: now,
      updatedAt: now,
    };
    rewrites.push(rule);
  } else {
    rule.versions = Array.isArray(rule.versions) ? rule.versions : [];
    rule.versions.push(newVersion);
    rule.activeVersionId = newVersion.id;
    rule.updatedAt = now;
  }
  // 自动给版本编号
  rule.versions.forEach((v, idx) => {
    if (!v.label) v.label = `版本 ${idx + 1}`;
  });
  await saveAllUiRewrites(rewrites);
  return { rule, version: newVersion };
}

export async function setActiveVersion(ruleId, versionId) {
  const rewrites = await loadAllUiRewrites();
  const rule = rewrites.find((r) => r.id === ruleId);
  if (!rule) return null;
  rule.activeVersionId = versionId || UI_REWRITE_ORIGINAL_VERSION;
  rule.updatedAt = Date.now();
  await saveAllUiRewrites(rewrites);
  return rule;
}

export async function deleteVersion(ruleId, versionId) {
  const rewrites = await loadAllUiRewrites();
  const rule = rewrites.find((r) => r.id === ruleId);
  if (!rule) return null;
  rule.versions = (rule.versions || []).filter((v) => v.id !== versionId);
  if (rule.activeVersionId === versionId) {
    rule.activeVersionId =
      rule.versions[rule.versions.length - 1]?.id ||
      UI_REWRITE_ORIGINAL_VERSION;
  }
  rule.updatedAt = Date.now();
  await saveAllUiRewrites(rewrites);
  return rule;
}

export async function deleteRule(ruleId) {
  const rewrites = await loadAllUiRewrites();
  const next = rewrites.filter((r) => r.id !== ruleId);
  await saveAllUiRewrites(next);
}

export async function updateRuleMeta(ruleId, patch = {}) {
  const rewrites = await loadAllUiRewrites();
  const rule = rewrites.find((r) => r.id === ruleId);
  if (!rule) return null;
  if (typeof patch.label === "string") rule.label = patch.label.trim();
  if (typeof patch.urlPattern === "string") {
    rule.urlPattern = patch.urlPattern.trim();
  }
  rule.updatedAt = Date.now();
  await saveAllUiRewrites(rewrites);
  return rule;
}

export function buildUiRewriteSystemPrompt() {
  return [
    "你是一名前端 UI/UX 设计师。",
    "请根据用户的中文需求，针对当前网页生成一段 CSS 代码，对页面进行视觉改造。",
    "约束：",
    "1) 只输出纯 CSS，不要使用 ```css 代码块包裹，不要任何额外说明文字。",
    "2) 不要使用 @import、url(http...) 等会发起网络请求的特性。",
    "3) 不要使用 !important 大面积覆盖；仅在必要时使用。",
    "4) 不要破坏页面交互（按钮、输入框、链接必须仍可点击/输入）。",
    "5) 优先使用通用语义选择器，避免依赖具体网页可能不存在的 class 名。",
    "6) 不要修改 display 属性导致重要元素被隐藏。",
  ].join("\n");
}

export function buildUiRewriteUserPrompt({ url, title, prompt }) {
  return [
    `当前网页 URL：${url || "(未知)"}`,
    `当前网页标题：${title || "(未知)"}`,
    "",
    "用户的改造需求：",
    String(prompt || "").trim(),
    "",
    "请直接输出 CSS：",
  ].join("\n");
}

export function stripCssFences(text) {
  if (!text) return "";
  let out = String(text).trim();
  out = out.replace(/^```(?:css)?\s*/i, "").replace(/```\s*$/i, "");
  return out.trim();
}
