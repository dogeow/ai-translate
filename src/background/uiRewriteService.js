/**
 * 调用当前选定的 AI 厂家生成 CSS 改造代码。
 * 复用 translationProviders 的 runProviderCompletion 接口。
 */
import { migrateSettingsIfNeeded } from "../shared/settings.js";
import {
  resolveProviderRuntime,
  buildMissingCredentialError,
  normalizeRuntimeSettings,
} from "./translationSettings.js";
import {
  runProviderCompletion,
  toProviderError,
} from "./translationProviders.js";
import {
  buildUiRewriteSystemPrompt,
  buildUiRewriteUserPrompt,
  stripCssFences,
  upsertUiRewriteVersion,
  loadAllUiRewrites,
  setActiveVersion,
  deleteVersion,
  deleteRule,
  updateRuleMeta,
  findUiRewriteForUrl,
  getActiveCss,
} from "../shared/ui-rewrites.js";
import { PROVIDER_CHROME_AI } from "../shared/constants.js";

async function getRuntimeSettings() {
  const { settings: stored } = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  return normalizeRuntimeSettings(stored);
}

export async function generateUiRewriteCss({ url, title, prompt }) {
  const text = String(prompt || "").trim();
  if (!text) {
    return { ok: false, error: "请输入改造需求。" };
  }
  const settings = await getRuntimeSettings();
  const runtime = resolveProviderRuntime(settings);
  if (runtime.provider === PROVIDER_CHROME_AI) {
    return {
      ok: false,
      error: "Chrome 内置 AI 仅支持翻译，不能生成 CSS。请先在设置中切换厂家。",
    };
  }
  const credentialError = buildMissingCredentialError(runtime, settings);
  if (credentialError) {
    return { ok: false, error: credentialError };
  }
  const fullPrompt =
    `${buildUiRewriteSystemPrompt()}\n\n` +
    buildUiRewriteUserPrompt({ url, title, prompt: text });

  let raw = "";
  try {
    raw = await runProviderCompletion({
      provider: runtime.provider,
      base: runtime.base,
      model: runtime.selectedModel,
      apiKey: runtime.apiKey,
      prompt: fullPrompt,
      text,
      targetLang: runtime.targetLang,
    });
  } catch (error) {
    return {
      ok: false,
      error: toProviderError(runtime.provider, error) || "AI 调用失败",
    };
  }

  const css = stripCssFences(raw);
  if (!css) {
    return { ok: false, error: "AI 没有返回有效的 CSS。" };
  }

  const { rule, version } = await upsertUiRewriteVersion({
    url,
    prompt: text,
    css,
    provider: runtime.provider,
    model: runtime.selectedModel,
  });

  return {
    ok: true,
    css,
    rule,
    version,
  };
}

export async function applyRewriteToTab(tabId, payload) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(
      tabId,
      { action: "applyUiRewrite", ...payload },
      () => {
        void chrome.runtime.lastError;
      },
    );
  } catch (_) {}
}

export async function broadcastRewriteUpdate() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab?.id || !tab.url) continue;
      try {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "uiRewriteRulesChanged" },
          () => {
            void chrome.runtime.lastError;
          },
        );
      } catch (_) {}
    }
  } catch (_) {}
}

export async function handleUiRewriteMessage(msg, sender) {
  if (msg.action === "generateUiRewrite") {
    const tabId = sender?.tab?.id || msg.tabId;
    let url = msg.url || "";
    let title = msg.title || "";
    if (!url && tabId) {
      try {
        const tab = await chrome.tabs.get(tabId);
        url = tab.url || "";
        title = title || tab.title || "";
      } catch (_) {}
    }
    const result = await generateUiRewriteCss({
      url,
      title,
      prompt: msg.prompt,
    });
    if (result.ok && tabId) {
      await applyRewriteToTab(tabId, {
        css: result.css,
        ruleId: result.rule.id,
        versionId: result.version.id,
      });
      await broadcastRewriteUpdate();
    }
    return result;
  }

  if (msg.action === "getUiRewrites") {
    const rewrites = await loadAllUiRewrites();
    return { ok: true, rewrites };
  }

  if (msg.action === "getUiRewriteForUrl") {
    const rule = await findUiRewriteForUrl(msg.url);
    return { ok: true, rule, css: getActiveCss(rule) };
  }

  if (msg.action === "setUiRewriteActiveVersion") {
    const rule = await setActiveVersion(msg.ruleId, msg.versionId);
    await broadcastRewriteUpdate();
    return { ok: true, rule };
  }

  if (msg.action === "deleteUiRewriteVersion") {
    const rule = await deleteVersion(msg.ruleId, msg.versionId);
    await broadcastRewriteUpdate();
    return { ok: true, rule };
  }

  if (msg.action === "deleteUiRewriteRule") {
    await deleteRule(msg.ruleId);
    await broadcastRewriteUpdate();
    return { ok: true };
  }

  if (msg.action === "updateUiRewriteRule") {
    const rule = await updateRuleMeta(msg.ruleId, msg.patch || {});
    await broadcastRewriteUpdate();
    return { ok: true, rule };
  }

  return null;
}
