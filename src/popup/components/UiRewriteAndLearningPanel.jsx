import { useEffect, useState } from "react";
import { Panel } from "./Panel.jsx";
import { PopupModelField } from "./PopupModelField.jsx";
import { useCurrentPageRewrite } from "../hooks/useCurrentPageRewrite.js";
import {
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
} from "../../shared/word-learning.js";

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

export function UiRewriteAndLearningPanel({
  uiRewriteProvider,
  learningProvider,
  onUiRewriteProviderChange,
  onLearningProviderChange,
  availableModels = [],
  modelsLoading = false,
  onOpenProviderSetup,
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [wordMarkingEnabled, setWordMarkingEnabled] = useState(false);
  const [recognitionModeEnabled, setRecognitionModeEnabled] = useState(false);
  const currentPageRewrite = useCurrentPageRewrite();

  useEffect(() => {
    chrome.storage.sync.get(
      [WORD_MARKING_ENABLED_KEY, WORD_RECOGNITION_MODE_ENABLED_KEY],
      (value) => {
        setWordMarkingEnabled(value?.[WORD_MARKING_ENABLED_KEY] === true);
        setRecognitionModeEnabled(
          value?.[WORD_RECOGNITION_MODE_ENABLED_KEY] === true,
        );
      },
    );
    function onChanged(changes, area) {
      if (area === "sync") {
        if (WORD_MARKING_ENABLED_KEY in changes) {
          setWordMarkingEnabled(
            changes[WORD_MARKING_ENABLED_KEY].newValue === true,
          );
        }
        if (WORD_RECOGNITION_MODE_ENABLED_KEY in changes) {
          setRecognitionModeEnabled(
            changes[WORD_RECOGNITION_MODE_ENABLED_KEY].newValue === true,
          );
        }
      }
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

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
      (res) => {
        setBusy(false);
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message, "error");
          return;
        }
        if (res?.ok) {
          currentPageRewrite.markApplied(res.rule, res.version);
          setMessage("已应用到当前页", "success");
          setPrompt("");
        } else {
          setMessage(res?.error || "生成失败", "error");
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

  function toggleMark() {
    const next = !wordMarkingEnabled;
    setWordMarkingEnabled(next);
    chrome.storage.sync.set({ [WORD_MARKING_ENABLED_KEY]: next });
  }

  function toggleRecognitionMode() {
    const next = !recognitionModeEnabled;
    setRecognitionModeEnabled(next);
    chrome.storage.sync.set({
      [WORD_RECOGNITION_MODE_ENABLED_KEY]: next,
    });
  }

  return (
    <Panel
      title="AI 页面改造"
      isSubtle
      className="popup-panel--learning"
      showStatus={!!status}
      statusText={status}
      statusTone={statusTone}
    >
      <PopupModelField
        id="popup-ui-rewrite-model"
        label="改造模型"
        value={uiRewriteProvider}
        onChange={onUiRewriteProviderChange}
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
          onChange={(e) => setPrompt(e.target.value)}
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
      <div className="popup-learning">
        <div className="popup-learning__heading">英语学习</div>
        <PopupModelField
          id="popup-learning-model"
          label="学习模型"
          value={learningProvider}
          onChange={onLearningProviderChange}
          options={availableModels}
          isLoading={modelsLoading}
          onOpenSetup={onOpenProviderSetup}
          className="popup-field--flush"
        />
        <label className="popup-learning-toggle">
          <span className="popup-learning-toggle__copy">
            <span className="popup-learning-toggle__title">生词标记</span>
            <span className="popup-learning-toggle__hint">
              用橙色边框方框标记学习中的单词
            </span>
          </span>
          <input
            className="popup-learning-toggle__input"
            type="checkbox"
            checked={wordMarkingEnabled}
            onChange={toggleMark}
          />
          <span className="popup-learning-toggle__control" aria-hidden="true">
            <span className="popup-learning-toggle__thumb" />
          </span>
        </label>
        <label className="popup-learning-toggle">
          <span className="popup-learning-toggle__copy">
            <span className="popup-learning-toggle__title">认词模式</span>
            <span className="popup-learning-toggle__hint">
              用蓝色边框方框标记其他单词
            </span>
          </span>
          <input
            className="popup-learning-toggle__input"
            type="checkbox"
            checked={recognitionModeEnabled}
            onChange={toggleRecognitionMode}
          />
          <span className="popup-learning-toggle__control" aria-hidden="true">
            <span className="popup-learning-toggle__thumb" />
          </span>
        </label>
      </div>
    </Panel>
  );
}
