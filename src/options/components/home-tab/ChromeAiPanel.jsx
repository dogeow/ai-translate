import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkChromeAiAvailability,
  isChromeAiSupported,
  prepareChromeAiTranslator,
  probeChromeAiAvailablePairs,
} from "../../../shared/chrome-ai-api.js";

function StatusRow({ label, tone, text, action }) {
  return (
    <div className={`chrome-ai-row chrome-ai-row--${tone}`}>
      <div className="chrome-ai-row-main">
        <span className={`chrome-ai-row-dot chrome-ai-row-dot--${tone}`} />
        <span className="chrome-ai-row-label">{label}</span>
        <span className="chrome-ai-row-text">{text}</span>
      </div>
      {action ? <div className="chrome-ai-row-action">{action}</div> : null}
    </div>
  );
}

function describeTranslator(av, sourceCode, targetCode) {
  const pair = sourceCode && targetCode ? `${sourceCode} → ${targetCode}` : "";
  if (av === "available") return { tone: "ok", text: `${pair} 已就绪` };
  if (av === "downloading") return { tone: "warn", text: `${pair} 模型下载中…` };
  if (av === "downloadable") return { tone: "warn", text: `${pair} 模型未下载` };
  if (av === "unsupported") return { tone: "err", text: "API 不可用" };
  return { tone: "err", text: pair ? `${pair} 不支持` : "不支持当前目标语言" };
}

export function ChromeAiPanel({
  isChromeAi,
  targetLang,
  onAfterDownload,
}) {
  const [supported, setSupported] = useState(true);
  const [translator, setTranslator] = useState("checking");
  const [sourceCode, setSourceCode] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const [availablePairs, setAvailablePairs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasProgress, setHasProgress] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorText, setErrorText] = useState("");
  const tokenRef = useRef(0);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!isChromeAi) return;
    const sup = isChromeAiSupported();
    setSupported(sup);
    if (!sup) {
      setTranslator("unsupported");
      setAvailablePairs([]);
      return;
    }
    setTranslator("checking");
    try {
      const [status, pairs] = await Promise.all([
        checkChromeAiAvailability(targetLang),
        probeChromeAiAvailablePairs(),
      ]);
      setTranslator(status.translator);
      setSourceCode(status.sourceCode);
      setTargetCode(status.targetCode);
      setAvailablePairs(pairs);
    } catch (_) {
      setTranslator("unavailable");
      setAvailablePairs([]);
    }
  }, [isChromeAi, targetLang]);

  useEffect(() => {
    if (!isChromeAi) return;
    setIsDownloading(false);
    setProgress(0);
    setHasProgress(false);
    setElapsedSec(0);
    setErrorText("");
    void refresh();
  }, [isChromeAi, targetLang, refresh]);

  useEffect(() => {
    if (!isDownloading) return;
    const startedAt = Date.now();
    setElapsedSec(0);
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [isDownloading]);

  if (!isChromeAi) return null;

  const translatorReady = translator === "available";
  const translatorMissing =
    translator === "downloadable" || translator === "downloading";

  const runDownload = async () => {
    if (isDownloading) return;
    const token = ++tokenRef.current;
    setProgress(0);
    setHasProgress(false);
    setErrorText("");
    setIsDownloading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await prepareChromeAiTranslator(targetLang, {
        onDownloadProgress: (loaded) => {
          if (token !== tokenRef.current) return;
          setProgress(loaded);
          setHasProgress(true);
        },
        signal: controller.signal,
      });
      if (token !== tokenRef.current) return;
      setProgress(1);
      setHasProgress(true);
      setIsDownloading(false);
      await refresh();
      onAfterDownload?.();
    } catch (error) {
      if (token !== tokenRef.current) return;
      setIsDownloading(false);
      if (error?.message !== "已取消") {
        setErrorText(error?.message || String(error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancelDownload = () => abortRef.current?.abort();

  const formatProgressLabel = () => {
    if (hasProgress) return `下载中… ${Math.round(progress * 100)}%`;
    if (elapsedSec > 0) return `下载中… 已等待 ${elapsedSec}s`;
    return "下载中…";
  };

  const translatorAction = !supported
    ? null
    : translatorMissing
      ? (
          <button
            type="button"
            className="btn btn-primary chrome-ai-row-btn"
            disabled={isDownloading}
            onClick={runDownload}
          >
            {isDownloading ? formatProgressLabel() : "下载翻译模型"}
          </button>
        )
      : null;

  const translatorInfo = describeTranslator(translator, sourceCode, targetCode);

  return (
    <div className="chrome-ai-panel">
      <div className="chrome-ai-panel-header">
        <strong>Chrome 内置 AI 模型</strong>
        <button
          type="button"
          className="chrome-ai-link-btn"
          onClick={refresh}
          disabled={isDownloading}
        >
          重新检测
        </button>
      </div>

      <StatusRow
        label="翻译"
        tone={translator === "checking" ? "muted" : translatorInfo.tone}
        text={translator === "checking" ? "检测中…" : translatorInfo.text}
        action={translatorAction}
      />

      {isDownloading ? (
        <>
          {hasProgress ? (
            <div className="chrome-ai-progress">
              <div
                className="chrome-ai-progress-bar"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          ) : (
            <div className="chrome-ai-progress chrome-ai-progress--indeterminate">
              <div className="chrome-ai-progress-bar chrome-ai-progress-bar--indeterminate" />
            </div>
          )}
          <div className="chrome-ai-progress-meta">
            <span>{formatProgressLabel()}</span>
            <button
              type="button"
              className="chrome-ai-link-btn"
              onClick={cancelDownload}
            >
              取消
            </button>
          </div>
        </>
      ) : null}

      {errorText ? (
        <p className="chrome-ai-panel-error">{errorText}</p>
      ) : translatorReady && !isDownloading ? (
        <p className="chrome-ai-panel-success">✓ 翻译模型已就绪，可离线翻译。</p>
      ) : null}

      {supported && availablePairs.length > 0 ? (
        <div className="chrome-ai-pairs">
          <div className="chrome-ai-pairs-label">
            已下载的语言对（{availablePairs.length}）
          </div>
          <div className="chrome-ai-pairs-list">
            {availablePairs.map((pair) => {
              const isCurrent =
                pair.source === sourceCode && pair.target === targetCode;
              return (
                <span
                  key={`${pair.source}-${pair.target}`}
                  className={`chrome-ai-pair-chip${isCurrent ? " chrome-ai-pair-chip--current" : ""}`}
                >
                  {pair.source} → {pair.target}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
