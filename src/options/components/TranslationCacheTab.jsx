import { TRANSLATION_CACHE_MAX_ENTRIES } from "../../shared/constants.js";
import { useTranslationCache } from "../hooks/useTranslationCache.js";

function formatDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString();
}

function formatTriggerSource(value) {
  const source = String(value || "").trim();
  if (!source) return "-";

  const labels = {
    hover: "悬停",
    selection: "选区",
    "page-visual": "页面翻译",
    "page-visual-batch": "页面批量翻译",
  };
  return labels[source] || source;
}

export function TranslationCacheTab() {
  const {
    entries,
    loading,
    error,
    copyStatus,
    refreshEntries,
    clearEntries,
    copyEntries,
  } = useTranslationCache();
  const hasEntries = entries.length > 0;

  return (
    <div className="card translation-cache-card">
      <h2>翻译缓存</h2>
      <p className="translation-cache-desc">
        展示最近 {TRANSLATION_CACHE_MAX_ENTRIES} 条成功翻译的本地缓存。相同原文会按目标语言和模型去重，并用最新结果覆盖。
      </p>

      <div className="translation-cache-toolbar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={refreshEntries}
        >
          刷新
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={copyEntries}
          disabled={!hasEntries}
        >
          复制全部
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={clearEntries}
          disabled={!hasEntries}
        >
          清空缓存
        </button>
      </div>

      <div className="translation-cache-summary">
        <span>总计 {entries.length} 条</span>
      </div>

      {loading ? (
        <div className="translation-cache-empty">正在加载缓存...</div>
      ) : null}
      {!loading && !hasEntries ? (
        <div className="translation-cache-empty">
          暂无缓存。成功翻译后会自动记录到这里。
        </div>
      ) : null}
      {error ? <div className="translation-cache-error">{error}</div> : null}
      {copyStatus ? (
        <div className="translation-cache-status">{copyStatus}</div>
      ) : null}

      {hasEntries ? (
        <div className="translation-cache-list">
          {entries.map((entry) => (
            <details key={entry.id} className="translation-cache-item">
              <summary className="translation-cache-item__summary">
                <span className="translation-cache-item__summary-main">
                  <span className="translation-cache-item__original">
                    {entry.original}
                  </span>
                  <span className="translation-cache-item__meta">
                    {entry.targetLang || "-"} / {entry.provider || "-"} /{" "}
                    {entry.model || "-"}
                  </span>
                </span>
                <span className="translation-cache-item__summary-meta">
                  {formatDateTime(entry.updatedAt)}
                </span>
              </summary>

              <div className="translation-cache-item__meta-row">
                <span>来源：{formatTriggerSource(entry.triggerSource)}</span>
                <span>时间：{formatDateTime(entry.updatedAt)}</span>
              </div>

              <div className="translation-cache-item__section">
                <div className="translation-cache-item__label">原文</div>
                <pre className="translation-cache-item__block">
                  {entry.original}
                </pre>
              </div>

              <div className="translation-cache-item__section">
                <div className="translation-cache-item__label">译文</div>
                <pre className="translation-cache-item__block">
                  {entry.translation}
                </pre>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
