import { Panel } from "./Panel.jsx";
import { PopupModelField } from "./PopupModelField.jsx";
import { PAGE_TRANSLATE_DISPLAY_MODE_OPTIONS } from "../lib/pageTranslateState.js";

const PROVIDER_SELECT_ID = "popup-provider-select";

export function QuickActionsPanel({
  appEnabled,
  isTogglingPageTranslate,
  isChangingPageDisplayMode,
  isPageTranslateActive,
  pageDisplayMode,
  pageTranslateStatus,
  onTogglePageTranslate,
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
  return (
    <Panel
      title="快速操作"
      isSubtle
      className="popup-panel--quick"
      showStatus={showStatus}
      statusText={statusText}
      statusTone={statusTone}
    >
      <div className="popup-page-translate-actions">
        <button
          type="button"
          className={`btn popup-page-translate-btn${isPageTranslateActive ? " btn-secondary popup-page-translate-btn--stop" : " btn-primary"}`}
          onClick={onTogglePageTranslate}
          disabled={!appEnabled || isTogglingPageTranslate}
          title={
            isPageTranslateActive
              ? "停止继续翻译，已完成的译文会保留"
              : "只翻译当前页面，离开后不会自动翻译"
          }
        >
          {isTogglingPageTranslate
            ? isPageTranslateActive
              ? "停止中..."
              : "启动中..."
            : isPageTranslateActive
              ? "停止翻译"
              : "翻译该页面"}
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
      <PopupModelField
        id={PROVIDER_SELECT_ID}
        label="翻译模型"
        value={provider}
        onChange={onProviderChange}
        options={availableProviders}
        isLoading={providersLoading}
        onOpenSetup={onOpenProviderSetup}
      />
    </Panel>
  );
}
