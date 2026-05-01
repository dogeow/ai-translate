import { useEffect, useState } from "react";
import {
  PROVIDER_CHROME_AI,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";
import {
  checkChromeAiAvailability,
  isChromeAiSupported,
} from "../../shared/chrome-ai-api.js";
import { Panel } from "./Panel.jsx";

const PROVIDER_SELECT_ID = "popup-provider-select";

function useChromeAiHint(provider) {
  const [hint, setHint] = useState(null);
  useEffect(() => {
    if (provider !== PROVIDER_CHROME_AI) {
      setHint(null);
      return;
    }
    if (!isChromeAiSupported()) {
      setHint({
        tone: "err",
        text: "当前浏览器不支持，需 Chrome 138+ 或 Edge 同等版本。",
      });
      return;
    }
    let cancelled = false;
    chrome.storage.sync.get(["translateTargetLang"], (stored) => {
      const targetLang = stored?.translateTargetLang || "Chinese";
      checkChromeAiAvailability(targetLang).then(
        (status) => {
          if (cancelled) return;
          if (status.translator === "available") {
            setHint({ tone: "ok", text: "模型已就绪，离线即可翻译。" });
          } else if (status.translator === "downloading") {
            setHint({ tone: "warn", text: "语言模型下载中…" });
          } else if (status.translator === "downloadable") {
            setHint({
              tone: "warn",
              text: "首次翻译会自动下载语言模型，可在设置中提前下载。",
            });
          } else {
            setHint({
              tone: "err",
              text: "Chrome 内置 AI 不支持当前目标语言，请在设置中切换。",
            });
          }
        },
        () => {
          if (!cancelled)
            setHint({ tone: "err", text: "Chrome 内置 AI 检测失败。" });
        },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);
  return hint;
}

export function QuickActionsPanel({
  appEnabled,
  isStartingPageTranslate,
  pageTranslateStatus,
  onStartPageTranslate,
  onToggleSiteAutoTranslate,
  siteAutoTranslateEnabled,
  activeOrigin,
  provider,
  onProviderChange,
  showStatus = false,
  statusText,
  statusTone,
}) {
  const chromeAiHint = useChromeAiHint(provider);
  return (
    <Panel
      title="快速操作"
      isSubtle
      showStatus={showStatus}
      statusText={statusText}
      statusTone={statusTone}
    >
      <div className="popup-page-translate-actions">
        <button
          type="button"
          className="btn btn-primary popup-page-translate-btn"
          onClick={onStartPageTranslate}
          disabled={!appEnabled || isStartingPageTranslate}
          title="只翻译当前页面，离开后不会自动翻译"
        >
          {isStartingPageTranslate ? "启动中..." : "翻译该页面"}
        </button>
        <button
          type="button"
          className={`btn popup-site-translate-btn${siteAutoTranslateEnabled ? " popup-site-translate-btn--on" : ""}`}
          onClick={onToggleSiteAutoTranslate}
          disabled={!appEnabled || !activeOrigin}
          title={
            !activeOrigin
              ? "当前页面不支持（仅 http/https）"
              : siteAutoTranslateEnabled
                ? `点击关闭：${activeOrigin}`
                : `打开后访问 ${activeOrigin} 下任意页面都会自动翻译`
          }
        >
          {siteAutoTranslateEnabled ? "✓ 翻译该网站" : "翻译该网站"}
        </button>
      </div>
      {pageTranslateStatus && (
        <div className="popup-page-translate-status" role="status">
          {pageTranslateStatus}
        </div>
      )}
      <div className="popup-field">
        <label className="popup-field__label" htmlFor={PROVIDER_SELECT_ID}>
          API 厂家
        </label>
        <select
          id={PROVIDER_SELECT_ID}
          className="popup-provider-select"
          value={provider}
          onChange={(event) => onProviderChange(event.target.value)}
        >
          {TRANSLATE_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {chromeAiHint ? (
          <div className={`popup-provider-hint popup-provider-hint--${chromeAiHint.tone}`}>
            {chromeAiHint.text}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}