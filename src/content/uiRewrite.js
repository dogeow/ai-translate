/**
 * AI 页面 UI 改造 - content 端
 * - 启动时向 background 拉取当前 URL 匹配的规则
 * - 注入/切换 <style id="__ai_translate_ui_rewrite__">
 * - 监听消息：applyUiRewrite / uiRewriteRulesChanged / openUiRewritePrompt
 */
import { UI_REWRITE_ORIGINAL_VERSION } from "../shared/ui-rewrites.js";
import {
  MAX_REWRITE_USER_IMAGES,
  extractDataUrl,
  isImageDataUrl,
} from "../shared/ui-rewrite-media.js";
import { collectUiRewriteSnapshot } from "./uiRewriteSnapshot.js";

const STYLE_TAG_ID = "__ai_translate_ui_rewrite__";
const PROMPT_OVERLAY_ID = "__ai_translate_ui_rewrite_overlay__";

let currentRuleId = "";
let currentVersionId = "";

function ensureStyleTag() {
  let tag = document.getElementById(STYLE_TAG_ID);
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    tag.dataset.aiTranslate = "ui-rewrite";
    (document.head || document.documentElement).appendChild(tag);
  }
  return tag;
}

function applyCss(css) {
  const tag = ensureStyleTag();
  tag.textContent = css || "";
}

function clearCss() {
  const tag = document.getElementById(STYLE_TAG_ID);
  if (tag) tag.textContent = "";
}

function sendBg(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function isRewriteActive() {
  return Boolean(
    currentVersionId && currentVersionId !== UI_REWRITE_ORIGINAL_VERSION,
  );
}

function collectContextHtml() {
  return collectUiRewriteSnapshot(document, {
    skipIds: [STYLE_TAG_ID, PROMPT_OVERLAY_ID],
  });
}

async function refreshFromStorage() {
  const url = window.location.href;
  const res = await sendBg({ action: "getUiRewriteForUrl", url });
  if (!res?.ok) return;
  const rule = res.rule;
  const css = res.css || "";
  if (rule) {
    currentRuleId = rule.id;
    currentVersionId = rule.activeVersionId;
  } else {
    currentRuleId = "";
    currentVersionId = "";
  }
  if (css) {
    applyCss(css);
  } else {
    clearCss();
  }
}

function closeOverlay() {
  const node = document.getElementById(PROMPT_OVERLAY_ID);
  if (node) node.remove();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function openPromptOverlay() {
  closeOverlay();
  const correcting = isRewriteActive();
  const images = [];
  const overlay = document.createElement("div");
  overlay.id = PROMPT_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(0,0,0,0.45); display: flex;
    align-items: center; justify-content: center;
    font: 14px -apple-system, "Segoe UI", sans-serif;
  `;

  const panel = document.createElement("div");
  panel.style.cssText = `
    width: min(440px, 92vw); background: #1a1a1f; color: #fafafa;
    border: 1px solid #2a2a30; border-radius: 12px; padding: 18px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `;
  panel.innerHTML = `
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">${
      correcting ? "继续修正这个页面" : "AI 改造这个页面"
    }</div>
    <div style="color:#a1a1aa;font-size:12px;margin-bottom:10px">
      ${
        correcting
          ? "说明哪里不好。会自动带上当前截图和上一版 CSS；也可粘贴或选择截图。"
          : "用一句话描述你想让 AI 改成什么样。会自动带上当前页面截图；也可粘贴截图。"
      }
    </div>
    <textarea id="__ai_tr_rw_input" rows="3" placeholder="${
      correcting
        ? "例如：按钮叠在一起、文字看不清、图片不见了"
        : "改造需求…"
    }"
      style="width:100%;background:#0f0f12;color:#fafafa;border:1px solid #27272a;border-radius:8px;padding:8px 10px;font:inherit;resize:vertical"></textarea>
    <div id="__ai_tr_rw_images" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
      <button data-act="pick" type="button" style="background:transparent;border:1px solid #27272a;color:#a1a1aa;padding:5px 10px;border-radius:6px;cursor:pointer">添加截图</button>
      <span style="color:#71717a;font-size:11px">支持粘贴，最多 ${MAX_REWRITE_USER_IMAGES} 张</span>
    </div>
    <input id="__ai_tr_rw_file" type="file" accept="image/*" hidden>
    <div id="__ai_tr_rw_status" style="margin-top:8px;color:#a1a1aa;font-size:12px;min-height:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
      <button data-act="cancel" style="background:transparent;border:1px solid #27272a;color:#a1a1aa;padding:6px 14px;border-radius:6px;cursor:pointer">取消</button>
      <button data-act="submit" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border:0;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer">${
        correcting ? "继续修正" : "生成"
      }</button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const input = panel.querySelector("#__ai_tr_rw_input");
  const status = panel.querySelector("#__ai_tr_rw_status");
  const submit = panel.querySelector('[data-act="submit"]');
  const fileInput = panel.querySelector("#__ai_tr_rw_file");
  const imageRow = panel.querySelector("#__ai_tr_rw_images");
  input?.focus();

  function renderImages() {
    imageRow.innerHTML = images
      .map(
        (dataUrl, index) => `
      <span style="position:relative;width:48px;height:48px;border-radius:6px;overflow:hidden;border:1px solid #27272a">
        <img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover">
        <button data-remove="${index}" type="button" style="position:absolute;top:0;right:0;border:0;background:#000a;color:#fff;width:16px;height:16px;line-height:16px;font-size:11px;cursor:pointer">×</button>
      </span>`,
      )
      .join("");
  }

  async function addImage(dataUrl) {
    const url = extractDataUrl(dataUrl);
    if (!isImageDataUrl(url) || images.includes(url)) return;
    if (images.length >= MAX_REWRITE_USER_IMAGES) {
      status.textContent = `最多添加 ${MAX_REWRITE_USER_IMAGES} 张截图`;
      return;
    }
    images.push(url);
    renderImages();
  }

  imageRow.addEventListener("click", (event) => {
    const index = event.target?.dataset?.remove;
    if (index == null) return;
    images.splice(Number(index), 1);
    renderImages();
  });

  input?.addEventListener("paste", (event) => {
    const items = [...(event.clipboardData?.items || [])];
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (file) void readFileAsDataUrl(file).then(addImage);
  });

  panel.addEventListener("click", async (event) => {
    const action = event.target?.dataset?.act;
    if (action === "cancel") {
      closeOverlay();
      return;
    }
    if (action === "pick") {
      fileInput?.click();
      return;
    }
    if (action === "submit") {
      const prompt = input?.value?.trim() || "";
      if (!prompt) {
        status.textContent = "请输入改造需求";
        return;
      }
      submit.disabled = true;
      overlay.dataset.busy = "true";
      status.textContent = correcting ? "正在对照当前效果修正…" : "AI 生成中…";
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      const res = await sendBg({
        action: "generateUiRewrite",
        url: window.location.href,
        title: document.title,
        prompt,
        htmlSnapshot: collectContextHtml(),
        images,
      });
      if (res?.ok) {
        closeOverlay();
      } else {
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = "";
        submit.disabled = false;
        delete overlay.dataset.busy;
        status.textContent = res?.error || "生成失败";
      }
    }
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void readFileAsDataUrl(file).then(addImage);
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });
  document.addEventListener(
    "keydown",
    function onKey(e) {
      if (e.key === "Escape") {
        closeOverlay();
        document.removeEventListener("keydown", onKey);
      }
    },
    { capture: true },
  );
}

export function initUiRewrite() {
  void refreshFromStorage();

  function onMessage(msg, _sender, sendResponse) {
    if (!msg) return;
    if (msg.action === "uiRewriteScreenshotCaptured") {
      const overlay = document.getElementById(PROMPT_OVERLAY_ID);
      if (overlay?.dataset.busy === "true") {
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = "";
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.action === "collectUiRewriteContext") {
      sendResponse({
        ok: true,
        html: collectContextHtml(),
        title: document.title,
      });
      return;
    }
    if (msg.action === "applyUiRewrite") {
      if (msg.css || msg.css === "") {
        applyCss(msg.css);
      }
      if (msg.ruleId) currentRuleId = msg.ruleId;
      if (msg.versionId) currentVersionId = msg.versionId;
    } else if (msg.action === "uiRewriteRulesChanged") {
      void refreshFromStorage();
    } else if (msg.action === "openUiRewritePrompt") {
      openPromptOverlay();
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);

  return function cleanup() {
    chrome.runtime.onMessage.removeListener(onMessage);
    clearCss();
    closeOverlay();
  };
}
