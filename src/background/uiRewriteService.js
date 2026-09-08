/**
 * 调用当前选定的 AI 厂家生成 CSS 改造代码。
 * 复用 translationProviders 的 runProviderCompletion 接口。
 */
import { migrateSettingsIfNeeded } from "../shared/settings.js";
import {
  PROVIDER_PURPOSE,
  resolvePurposeProviderRuntime,
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
  getActiveVersion,
} from "../shared/ui-rewrites.js";
import {
  isImageUnsupportedError,
  mergeRewriteImages,
} from "../shared/ui-rewrite-media.js";
import { PROVIDER_CHROME_AI } from "../shared/constants.js";

async function getRuntimeSettings() {
  const { settings: stored } = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  return normalizeRuntimeSettings(stored);
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    if (tabId == null) {
      resolve(null);
      return;
    }
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function collectPageHtmlSnapshot(tabId, provided = "") {
  const existing = String(provided || "").trim();
  if (existing) return existing;
  const response = await sendTabMessage(tabId, {
    action: "collectUiRewriteContext",
  });
  return String(response?.html || "").trim();
}

async function captureTabScreenshot(tab, expectedUrl) {
  if (tab?.id == null || tab.windowId == null) return "";
  let changed = false;
  const matchesTarget = (current) =>
    current?.active &&
    current.id === tab.id &&
    current.windowId === tab.windowId &&
    current.url === expectedUrl &&
    (!current.pendingUrl || current.pendingUrl === expectedUrl);
  const onActivated = (info) => {
    if (info.windowId === tab.windowId && info.tabId !== tab.id) changed = true;
  };
  const onUpdated = (tabId, changeInfo) => {
    if (tabId === tab.id && (changeInfo.url || changeInfo.status === "loading")) {
      changed = true;
    }
  };
  // captureVisibleTab captures the window's active tab, not a tab ID.
  // Reject captures spanning a tab switch or navigation, even if it switches back.
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  try {
    if (!matchesTarget(await chrome.tabs.get(tab.id)) || changed) return "";
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 55,
    });
    if (!matchesTarget(await chrome.tabs.get(tab.id)) || changed) return "";
    return typeof dataUrl === "string" ? dataUrl : "";
  } catch (_) {
    return "";
  } finally {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  }
}

async function completeWithImages(runtime, buildPrompt, text, images) {
  try {
    return await runProviderCompletion({
      provider: runtime.provider,
      base: runtime.base,
      model: runtime.selectedModel,
      apiKey: runtime.apiKey,
      prompt: buildPrompt(images.length > 0),
      text,
      targetLang: runtime.targetLang,
      images,
    });
  } catch (error) {
    if (images.length > 0 && isImageUnsupportedError(error)) {
      return runProviderCompletion({
        provider: runtime.provider,
        base: runtime.base,
        model: runtime.selectedModel,
        apiKey: runtime.apiKey,
        prompt: buildPrompt(false),
        text,
        targetLang: runtime.targetLang,
        images: [],
      });
    }
    throw error;
  }
}

export async function generateUiRewriteCss({
  url,
  title,
  prompt,
  htmlSnapshot = "",
  previousPrompt = "",
  previousCss = "",
  images = [],
} = {}) {
  const text = String(prompt || "").trim();
  if (!text) {
    return { ok: false, error: "请输入改造需求。" };
  }
  const settings = await getRuntimeSettings();
  const runtime = resolvePurposeProviderRuntime(
    settings,
    PROVIDER_PURPOSE.UI_REWRITE,
  );
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
  const prevCss = String(previousCss || "").trim();
  const buildPrompt = (hasImages) =>
    `${buildUiRewriteSystemPrompt({ hasPreviousCss: Boolean(prevCss) })}\n\n` +
    buildUiRewriteUserPrompt({
      url,
      title,
      prompt: text,
      htmlSnapshot,
      previousPrompt,
      previousCss: prevCss,
      hasImages,
    });

  let raw = "";
  try {
    raw = await completeWithImages(runtime, buildPrompt, text, images);
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
    const tabId = sender?.tab?.id ?? msg.tabId;
    let url = msg.url || "";
    let title = msg.title || "";
    let tab = null;
    if (tabId != null) {
      try {
        tab = await chrome.tabs.get(tabId);
        url = url || tab.url || "";
        title = title || tab.title || "";
      } catch (_) {}
    }
    const existingRule = await findUiRewriteForUrl(url);
    const previous = getActiveVersion(existingRule);
    const htmlSnapshot = await collectPageHtmlSnapshot(tabId, msg.htmlSnapshot);
    const screenshot = await captureTabScreenshot(tab, url);
    await sendTabMessage(tabId, { action: "uiRewriteScreenshotCaptured" });
    const images = mergeRewriteImages(screenshot, msg.images);
    const result = await generateUiRewriteCss({
      url,
      title,
      prompt: msg.prompt,
      htmlSnapshot,
      previousPrompt: previous?.prompt || "",
      previousCss: previous?.css || "",
      images,
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
