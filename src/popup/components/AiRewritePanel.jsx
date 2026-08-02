import { useState } from "react";
import { Panel } from "./Panel.jsx";
import { PopupModelField } from "./PopupModelField.jsx";
import { useCurrentPageRewrite } from "../hooks/useCurrentPageRewrite.js";

const UI_REWRITE_PRESETS = [
  {
    label: "专注阅读",
    prompt: "精简干扰元素，限制正文宽度并提升段落间距，做成专注阅读布局",
  },
  {
    label: "护眼配色",
    prompt: "改成低对比度的护眼配色，保持文字清晰并避免纯黑纯白",
  },
  {
    label: "正文放大",
    prompt: "增大正文和行距，优化标题层级，保持按钮与导航大小不变",
  },
];

export function AiRewritePanel({
  provider,
  onProviderChange,
  availableModels = [],
  modelsLoading = false,
  onOpenProviderSetup,
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const currentPageRewrite = useCurrentPageRewrite();

  function setMessage(text, tone = "neutral") {
    setStatus(text);
    setStatusTone(tone);
    if (text) {
      window.setTimeout(() => setStatus(""), 2200);
    }
  }

  async function submit() {
    const text = prompt.trim();
    if (!text) {
      setMessage("请输入改造需求", "error");
      return;
    }
    const tab = currentPageRewrite.activeTab;
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      setMessage("当前页面不支持（仅 http/https）", "error");
      return;
    }
    setBusy(true);
    setMessage("AI 生成中…", "neutral");
    chrome.runtime.sendMessage(
      {
        action: "generateUiRewrite",
        tabId: tab.id,
        url: tab.url,
        title: tab.title || "",
        prompt: text,
      },
      (response) => {
        setBusy(false);
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message, "error");
          return;
        }
        if (response?.ok) {
          currentPageRewrite.markApplied(response.rule, response.version);
          setMessage("已应用到当前页", "success");
          setPrompt("");
        } else {
          setMessage(response?.error || "生成失败", "error");
        }
      },
    );
  }

  async function restoreOriginal() {
    setMessage("正在恢复原版…", "neutral");
    const restored = await currentPageRewrite.restoreOriginal();
    setMessage(
      restored ? "已恢复当前网页原版" : "恢复失败，请重试",
      restored ? "success" : "error",
    );
  }

  return (
    <Panel
      title="AI 页面改造"
      isSubtle
      className="popup-panel--rewrite"
      showStatus={!!status}
      statusText={status}
      statusTone={statusTone}
    >
      <PopupModelField
        id="popup-ui-rewrite-model"
        label="改造模型"
        value={provider}
        onChange={onProviderChange}
        options={availableModels}
        isLoading={modelsLoading}
        onOpenSetup={onOpenProviderSetup}
        className="popup-field--flush"
      />
      <div className="popup-rewrite">
        <textarea
          rows={2}
          className="popup-rewrite__input"
          value={prompt}
          placeholder="例如：背景改为米色，正文增大"
          onChange={(event) => setPrompt(event.target.value)}
          disabled={busy}
        />
        <div className="popup-rewrite-presets" aria-label="常用改造模板">
          {UI_REWRITE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="popup-rewrite-preset"
              onClick={() => setPrompt(preset.prompt)}
              disabled={busy}
              title={preset.prompt}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="popup-rewrite__actions">
          {currentPageRewrite.isActive && (
            <button
              type="button"
              className="btn btn-secondary popup-rewrite__restore"
              onClick={restoreOriginal}
              disabled={busy || currentPageRewrite.isRestoring}
              title={
                currentPageRewrite.activeVersionLabel
                  ? `当前应用：${currentPageRewrite.activeVersionLabel}`
                  : "恢复到网页原始样式"
              }
            >
              {currentPageRewrite.isRestoring ? "恢复中…" : "恢复原版"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary popup-rewrite__btn"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "生成中…" : "AI 改造当前页"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
