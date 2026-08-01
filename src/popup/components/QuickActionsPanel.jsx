import { Panel } from "./Panel.jsx";
import { PAGE_TRANSLATE_DISPLAY_MODE_OPTIONS } from "../lib/pageTranslateState.js";

const PROVIDER_SELECT_ID = "popup-provider-select";

export function QuickActionsPanel({
  appEnabled,
  isStartingPageTranslate,
  isChangingPageDisplayMode,
  isPageTranslateActive,
  pageDisplayMode,
  pageTranslateStatus,
  onStartPageTranslate,
  onPageDisplayModeChange,
  onToggleSiteAutoTranslate,
  siteAutoTranslateEnabled,
  activeOrigin,
  provider,
  onProviderChange,
  availableProviders = [],
  providersLoading = false,
  onOpenProviderSetup,
  showStatus = false,
  statusText,
  statusTone,
}) {
  const selectedProvider = availableProviders.some(
    (option) => option.value === provider,
  )
    ? provider
    : availableProviders[0]?.value || "";
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
      <div className="popup-page-display">
        <span className="popup-page-display__label">页面显示</span>
        <div
          className="popup-page-display__options"
          role="group"
          aria-label="页面翻译显示方式"
        >
          {PAGE_TRANSLATE_DISPLAY_MODE_OPTIONS.map((option) => {
            const isActive = pageDisplayMode === option.value;
            const isDisabled =
              !appEnabled ||
              !isPageTranslateActive ||
              isChangingPageDisplayMode;
            return (
              <button
                key={option.value}
                type="button"
                className={`popup-page-display__option${isActive ? " popup-page-display__option--active" : ""}`}
                aria-pressed={isActive}
                disabled={isDisabled}
                title={
                  isPageTranslateActive
                    ? `切换为${option.label}显示`
                    : "翻译当前页面后即可切换"
                }
                onClick={() => onPageDisplayModeChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {pageTranslateStatus && (
        <div className="popup-page-translate-status" role="status">
          {pageTranslateStatus}
        </div>
      )}
      <div className="popup-field">
        <label className="popup-field__label" htmlFor={PROVIDER_SELECT_ID}>
          翻译引擎
        </label>
        {providersLoading ? (
          <button
            id={PROVIDER_SELECT_ID}
            type="button"
            className="popup-provider-select popup-provider-select--loading"
            disabled
          >
            正在检测可用引擎…
          </button>
        ) : availableProviders.length > 0 ? (
          <select
            id={PROVIDER_SELECT_ID}
            className="popup-provider-select"
            value={selectedProvider}
            onChange={(event) => onProviderChange(event.target.value)}
          >
            {availableProviders.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <button
            id={PROVIDER_SELECT_ID}
            type="button"
            className="popup-provider-empty"
            onClick={onOpenProviderSetup}
          >
            <span>暂无可用引擎</span>
            <strong>前往新增</strong>
          </button>
        )}
      </div>
    </Panel>
  );
}
