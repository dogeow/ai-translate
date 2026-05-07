/**
 * AI 页面 UI 改造 - content 端
 * - 启动时向 background 拉取当前 URL 匹配的规则
 * - 注入/切换 <style id="__ai_translate_ui_rewrite__">
 * - 监听消息：applyUiRewrite / uiRewriteRulesChanged / openUiRewritePrompt
 */
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

function openPromptOverlay() {
  closeOverlay();
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
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">AI 改造这个页面</div>
    <div style="color:#a1a1aa;font-size:12px;margin-bottom:10px">
      用一句话描述你想让 AI 改成什么样，例如「把背景换成米色，正文调大」。
    </div>
    <textarea id="__ai_tr_rw_input" rows="3" placeholder="改造需求…"
      style="width:100%;background:#0f0f12;color:#fafafa;border:1px solid #27272a;border-radius:8px;padding:8px 10px;font:inherit;resize:vertical"></textarea>
    <div id="__ai_tr_rw_status" style="margin-top:8px;color:#a1a1aa;font-size:12px;min-height:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
      <button data-act="cancel" style="background:transparent;border:1px solid #27272a;color:#a1a1aa;padding:6px 14px;border-radius:6px;cursor:pointer">取消</button>
      <button data-act="submit" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border:0;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer">生成</button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const input = panel.querySelector("#__ai_tr_rw_input");
  const status = panel.querySelector("#__ai_tr_rw_status");
  const submit = panel.querySelector('[data-act="submit"]');
  input?.focus();

  panel.addEventListener("click", async (event) => {
    const action = event.target?.dataset?.act;
    if (action === "cancel") {
      closeOverlay();
      return;
    }
    if (action === "submit") {
      const prompt = input?.value?.trim() || "";
      if (!prompt) {
        status.textContent = "请输入改造需求";
        return;
      }
      submit.disabled = true;
      status.textContent = "AI 生成中…";
      const res = await sendBg({
        action: "generateUiRewrite",
        url: window.location.href,
        title: document.title,
        prompt,
      });
      if (res?.ok) {
        status.textContent = "已应用！";
        setTimeout(() => closeOverlay(), 600);
      } else {
        submit.disabled = false;
        status.textContent = res?.error || "生成失败";
      }
    }
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

  function onMessage(msg) {
    if (!msg) return;
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
