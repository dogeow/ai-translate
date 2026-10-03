import { useState } from "react";
import { Panel } from "./Panel.jsx";
import { PopupModelField } from "./PopupModelField.jsx";
import { useCurrentPageRewrite } from "../hooks/useCurrentPageRewrite.js";
import {
  MAX_REWRITE_USER_IMAGES,
  extractDataUrl,
  isImageDataUrl,
} from "../../shared/ui-rewrite-media.js";

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

const CORRECTION_PRESET = {
  label: "修正排版",
  prompt:
    "对照当前效果修正：按钮和文字不要重叠或错位，对比度要够，不要挡住原有图片和内容",
};

function nextImageId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function AiRewritePanel({
  provider,
  onProviderChange,
  availableModels = [],
  modelsLoading = false,
  onOpenProviderSetup,
}) {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const currentPageRewrite = useCurrentPageRewrite();
  const correcting = currentPageRewrite.isActive;

  function setMessage(text, tone = "neutral") {
    setStatus(text);
    setStatusTone(tone);
    if (text) {
      window.setTimeout(() => setStatus(""), 2200);
    }
  }

  function addImageFromDataUrl(dataUrl) {
    const url = extractDataUrl(dataUrl);
    if (!isImageDataUrl(url)) return false;
    setImages((current) => {
      if (current.some((image) => image.dataUrl === url)) return current;
      if (current.length >= MAX_REWRITE_USER_IMAGES) {
        setMessage(`最多添加 ${MAX_REWRITE_USER_IMAGES} 张截图`, "error");
        return current;
      }
      return [...current, { id: nextImageId(), dataUrl: url }];
    });
    return true;
  }

  async function addImageFromFile(file) {
    if (!file?.type?.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    addImageFromDataUrl(dataUrl);
  }

  function removeImage(id) {
    setImages((current) => current.filter((image) => image.id !== id));
  }

  function handlePaste(event) {
    const items = [...(event.clipboardData?.items || [])];
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (file) void addImageFromFile(file);
  }

  function handleDrop(event) {
    const files = [...(event.dataTransfer?.files || [])];
    const imageFile = files.find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;
    event.preventDefault();
    void addImageFromFile(imageFile);
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
    setMessage(correcting ? "正在对照当前效果修正…" : "AI 生成中…", "neutral");
    chrome.runtime.sendMessage(
      {
        action: "generateUiRewrite",
        tabId: tab.id,
        url: tab.url,
        title: tab.title || "",
        prompt: text,
        images: images.map((image) => image.dataUrl),
      },
      (response) => {
        setBusy(false);
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message, "error");
          return;
        }
        if (response?.ok) {
          currentPageRewrite.markApplied(response.rule, response.version);
          setMessage(
            correcting ? "已按你的说明修正" : "已应用到当前页",
            "success",
          );
          setPrompt("");
          setImages([]);
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

  const presets = correcting
    ? [CORRECTION_PRESET, ...UI_REWRITE_PRESETS]
    : UI_REWRITE_PRESETS;

  return (
    <Panel
      title="自定义网页样式"
      hint="描述你想要的样式，AI 会调整当前网页。"
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
          rows={4}
          aria-label="页面改造需求"
          className="popup-rewrite__input"
          value={prompt}
          placeholder={
            correcting
              ? "指出哪里不好，例如：按钮重叠、文字看不清、图片不见了"
              : "例如：背景改为米色，正文增大"
          }
          onChange={(event) => setPrompt(event.target.value)}
          onPaste={handlePaste}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          disabled={busy}
        />
        <p className="popup-rewrite__hint">
          {correcting
            ? "会结合当前截图继续修正，也可补充截图。"
            : "自动附上页面截图，也可粘贴或拖入截图。"}
        </p>
        <div className="popup-rewrite-images">
          {images.map((image) => (
            <span key={image.id} className="popup-rewrite-thumb">
              <img src={image.dataUrl} alt="" />
              <button
                type="button"
                className="popup-rewrite-thumb__remove"
                onClick={() => removeImage(image.id)}
                disabled={busy}
                aria-label="移除截图"
              >
                ×
              </button>
            </span>
          ))}
          {images.length < MAX_REWRITE_USER_IMAGES ? (
            <label className="popup-rewrite-add-image">
              添加截图
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void addImageFromFile(file);
                }}
              />
            </label>
          ) : null}
        </div>
        <div className="popup-rewrite-presets" aria-label="常用改造模板">
          {presets.map((preset) => (
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
            {busy
              ? correcting
                ? "修正中…"
                : "生成中…"
              : correcting
                ? "继续修正当前效果"
                : "AI 改造当前页"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
