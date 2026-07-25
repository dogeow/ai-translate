import { useEffect, useMemo, useRef, useState } from "react";
import { TARGET_LANG_LABELS } from "../constants.js";
import { getModelName, getModelDisplay } from "../../shared/model-utils.js";
import { getOllamaErrorMessage } from "../../shared/ollama-errors.js";
import {
  buildYoudaoAudioUrl,
  isPronounceableEnglishWord,
} from "../../shared/youdao-api.js";

function getThinkingLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getLatestThinkingPreview(text, lineCount = 3) {
  const lines = getThinkingLines(text);
  if (lines.length === 0) return "";
  return lines.slice(-lineCount).join("\n");
}

function SpeakerIcon({ playing }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="ollama-tip-pronounce-icon"
    >
      <path d="M11 5 6.8 8.5H3.5v7h3.3L11 19V5Z" />
      {playing ? (
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.5a7.7 7.7 0 0 1 0 11" />
      ) : (
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      )}
    </svg>
  );
}

function OriginalTextSection({ text }) {
  const normalizedText = String(text || "").trim();
  const canPronounce = isPronounceableEnglishWord(normalizedText);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  function stopAudio({ resetState = true } = {}) {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
    if (resetState) setPlaying(false);
  }

  useEffect(() => {
    stopAudio();
    return () => stopAudio({ resetState: false });
  }, [normalizedText]);

  async function handlePronounce() {
    if (!canPronounce) return;
    if (audioRef.current) {
      stopAudio();
      return;
    }

    const audio = new Audio(buildYoudaoAudioUrl(normalizedText, 2));
    audioRef.current = audio;
    setPlaying(true);

    const finish = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setPlaying(false);
    };
    audio.onended = finish;
    audio.onerror = finish;

    try {
      await audio.play();
    } catch (_) {
      finish();
    }
  }

  return (
    <div className="ollama-tip-section">
      <div className="ollama-tip-label">原文</div>
      <div className="ollama-tip-original-inline">
        <span className="ollama-tip-text">{text || ""}</span>
        {canPronounce ? (
          <button
            type="button"
            className={`ollama-tip-pronounce${playing ? " is-playing" : ""}`}
            aria-label={playing ? "停止朗读" : "朗读单词（美式发音）"}
            title={playing ? "停止朗读" : "朗读单词（美式发音）"}
            onClick={() => void handlePronounce()}
          >
            <SpeakerIcon playing={playing} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SentenceStudyPlaceholder({ thinking = "" }) {
  const preview = getLatestThinkingPreview(thinking, 3);
  return (
    <div className="ollama-tip-grammar-section">
      <div className="ollama-tip-label">句型学习</div>
      <div className="ollama-tip-loading">分析中...</div>
      {preview ? (
        <div className="ollama-tip-thinking">
          <div className="ollama-tip-thinking-label">句型学习思考过程（最新三行）</div>
          <div className="ollama-tip-thinking-content ollama-tip-thinking-content--preview">
            {preview}
          </div>
        </div>
      ) : null}
      <div className="ollama-tip-placeholder ollama-tip-placeholder--title"></div>
      <div className="ollama-tip-placeholder"></div>
      <div className="ollama-tip-placeholder"></div>
    </div>
  );
}

function DownloadProgressBar({ progress }) {
  const pct = Math.max(0, Math.min(1, Number(progress) || 0));
  return (
    <div className="ollama-tip-download">
      <div className="ollama-tip-download-label">
        正在下载语言模型 {Math.round(pct * 100)}%
      </div>
      <div className="ollama-tip-download-track">
        <div
          className="ollama-tip-download-bar"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <div className="ollama-tip-download-hint">
        首次使用 Chrome 内置 AI，下载后离线即可翻译。
      </div>
    </div>
  );
}

function PendingTranslationSection({ result }) {
  const hasThinking = !!String(result.thinking || "").trim();
  const thinkingPreview = getLatestThinkingPreview(result.thinking, 3);
  const isDownloading =
    typeof result.downloadProgress === "number" && result.downloadProgress < 1;
  const loadingLabel = isDownloading
    ? "正在准备模型..."
    : hasThinking
      ? "思考中..."
      : "翻译中...";

  return (
    <div className="ollama-tip-section">
      <div className="ollama-tip-label">译文</div>
      <div className="ollama-tip-loading">{loadingLabel}</div>
      {isDownloading ? (
        <DownloadProgressBar progress={result.downloadProgress} />
      ) : null}
      {!isDownloading && hasThinking && thinkingPreview ? (
        <div className="ollama-tip-thinking">
          <div className="ollama-tip-thinking-label">思考过程（最新三行）</div>
          <div className="ollama-tip-thinking-content ollama-tip-thinking-content--preview">
            {thinkingPreview}
          </div>
        </div>
      ) : null}
      <div className="ollama-tip-placeholder"></div>
      <div className="ollama-tip-placeholder ollama-tip-placeholder--short"></div>
    </div>
  );
}

function ThinkingCollapsedSection({
  thinking,
  expanded,
  onExpandedChange,
  title = "思考过程（已折叠）",
  wrapperClassName = "ollama-tip-section",
}) {
  const fullThinking = String(thinking || "").trim();
  if (!fullThinking) return null;
  const displayThinking = `<think>\n${fullThinking}\n</think>`;

  return (
    <div className={wrapperClassName}>
      <details
        className="ollama-tip-thinking-details"
        open={expanded}
        onToggle={(event) => onExpandedChange?.(event.currentTarget.open)}
      >
        <summary className="ollama-tip-thinking-summary">
          <span className="ollama-tip-thinking-summary-title">{title}</span>
        </summary>
        <div className="ollama-tip-thinking-content">{displayThinking}</div>
      </details>
    </div>
  );
}

function SentenceStudySection({ sentenceStudy }) {
  const parts = Array.isArray(sentenceStudy?.parts) ? sentenceStudy.parts : [];
  const sentenceStudyThinking = String(sentenceStudy?.thinking || "").trim();
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  useEffect(() => {
    setThinkingExpanded(false);
  }, [sentenceStudyThinking, sentenceStudy?.pattern, parts.length]);

  if (parts.length === 0) return null;

  return (
    <div className="ollama-tip-grammar-section">
      <div className="ollama-tip-label">句型学习</div>
      <div className="ollama-tip-grammar-pattern">
        主句结构：{sentenceStudy.pattern || "句型分析"}
      </div>
      <div className="ollama-tip-grammar-parts">
        {parts.map((part, index) => (
          <div key={`${part.text}-${index}`} className="ollama-tip-grammar-part">
            <div className="ollama-tip-grammar-text">{part.text}</div>
            {part.translation ? (
              <div className="ollama-tip-grammar-translation">{part.translation}</div>
            ) : null}
            <div className="ollama-tip-grammar-line"></div>
            <div className="ollama-tip-grammar-role">{part.label}</div>
            {part.note ? <div className="ollama-tip-grammar-note">{part.note}</div> : null}
          </div>
        ))}
      </div>
      {sentenceStudyThinking ? (
        <ThinkingCollapsedSection
          thinking={sentenceStudyThinking}
          expanded={thinkingExpanded}
          onExpandedChange={setThinkingExpanded}
          title="句型学习思考过程（已折叠）"
          wrapperClassName="ollama-tip-grammar-thinking"
        />
      ) : null}
    </div>
  );
}

function NeedModelSection({ result, onTranslateWithModel }) {
  const firstModel = useMemo(
    () => getModelName(result.models?.[0]),
    [result.models],
  );
  const [selectedModel, setSelectedModel] = useState(firstModel);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedModel(firstModel);
    setIsSubmitting(false);
  }, [firstModel, result.original]);

  async function handleTranslate() {
    if (!selectedModel || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onTranslateWithModel(selectedModel);
    } catch (_) {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ollama-tip-body">
      <div className="ollama-tip-section">
        <div className="ollama-tip-label">请选择模型</div>
        <select
          className="ollama-tip-model-select"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
        >
          {(result.models || []).map((model) => {
            const name = getModelName(model);
            if (!name) return null;
            return (
              <option key={name} value={name}>
                {getModelDisplay(model)}
              </option>
            );
          })}
        </select>
      </div>
      <OriginalTextSection text={result.original} />
      <button
        type="button"
        className="ollama-tip-translate-btn"
        disabled={!selectedModel || isSubmitting}
        onClick={() => void handleTranslate()}
      >
        {isSubmitting ? "翻译中..." : "翻译"}
      </button>
    </div>
  );
}

export function TipView({ result, onClose, onTranslateWithModel }) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const targetLabel =
    (result.targetLang && TARGET_LANG_LABELS[result.targetLang]) ||
    result.targetLang ||
    "中文";
  const modelLabel = result.model ? `模型：${result.model}` : "";

  useEffect(() => {
    setCopied(false);
  }, [result.translation, result.requestId]);

  useEffect(() => {
    if (!result.pending) {
      setThinkingExpanded(false);
    }
  }, [result.pending, result.requestId, result.sentenceStudyPending, result.sentenceStudy]);

  async function handleCopy() {
    if (!result.translation) return;
    try {
      await navigator.clipboard.writeText(result.translation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (_) {}
  }

  let body = null;

  if (result.pending) {
    body = (
      <>
        <div className="ollama-tip-body">
          <OriginalTextSection text={result.original} />
          <PendingTranslationSection result={result} />
        </div>
        {result.learningModeEnabled ? (
          <SentenceStudyPlaceholder thinking={result.sentenceStudyThinking} />
        ) : null}
      </>
    );
  } else if (result.needModel && Array.isArray(result.models) && result.models.length > 0) {
    body = <NeedModelSection result={result} onTranslateWithModel={onTranslateWithModel} />;
  } else if (result.needModel && result.error) {
    body = (
      <div className="ollama-tip-body">
        <div className="ollama-tip-section">
          <div className="ollama-tip-error">{getOllamaErrorMessage(result.error)}</div>
        </div>
        <OriginalTextSection text={result.original} />
      </div>
    );
  } else {
    const shouldShowSentenceStudy =
      !result.error && result.translation && result.learningModeEnabled;

    body = (
      <>
        <div className="ollama-tip-body">
          {result.error ? (
            <div className="ollama-tip-section">
              <div className="ollama-tip-error">{getOllamaErrorMessage(result.error)}</div>
            </div>
          ) : null}
          <OriginalTextSection text={result.original} />
          <div className="ollama-tip-section">
            <div className="ollama-tip-label">译文</div>
            <div className="ollama-tip-translation-inline">
              <span className="ollama-tip-translation-content">
                {result.error ? "—" : result.translation || "（无译文）"}
              </span>
              {!result.error && result.translation ? (
                <button
                  type="button"
                  className="ollama-tip-copy"
                  aria-label={copied ? "已复制" : "复制译文"}
                  title={copied ? "已复制" : "复制译文"}
                  onClick={() => void handleCopy()}
                >
                  {copied ? "✓" : "⎘"}
                </button>
              ) : null}
            </div>
          </div>
          {result.thinking ? (
            <ThinkingCollapsedSection
              thinking={result.thinking}
              expanded={thinkingExpanded}
              onExpandedChange={setThinkingExpanded}
            />
          ) : null}
        </div>
        {shouldShowSentenceStudy ? (
          result.sentenceStudyPending ? (
            <SentenceStudyPlaceholder thinking={result.sentenceStudyThinking} />
          ) : result.sentenceStudy ? (
            <SentenceStudySection sentenceStudy={result.sentenceStudy} />
          ) : (
            <div className="ollama-tip-grammar-section">
              <div className="ollama-tip-label">句型学习</div>
              <div className="ollama-tip-grammar-empty">
                句型学习未生成，可重试一次或更换模型。
              </div>
            </div>
          )
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="ollama-tip-header">
        <span className="ollama-tip-title">翻译为：{targetLabel}</span>
        <div className="ollama-tip-header-actions">
          {modelLabel ? (
            <span className="ollama-tip-header-model" title={modelLabel}>
              {modelLabel}
            </span>
          ) : null}
          <button type="button" className="ollama-tip-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="ollama-tip-content">{body}</div>
    </>
  );
}
