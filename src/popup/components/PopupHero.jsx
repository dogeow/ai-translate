import { AppToggle } from "./AppToggle.jsx";

export function PopupHero({
  surface = "popup",
  appEnabled,
  onToggleApp,
  learningModeEnabled,
  learningModeSupported = true,
  onToggleLearningMode,
  onOpenSettings,
  onOpenEnglishExample,
  showSidePanelButton = false,
  sidePanelButtonDisabled = false,
  onOpenSidePanel,
}) {
  const isSidePanel = surface === "sidepanel";

  return (
    <header
      className={`popup-hero${isSidePanel ? " popup-hero--sidepanel" : ""}`}
    >
      <div className="popup-hero__top">
        <div className="popup-hero__title-group">
          {isSidePanel ? (
            <span className="popup-hero__surface-label">翻译功能</span>
          ) : (
            <h1>英语学习和AI翻译</h1>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-inline popup-settings-btn"
          onClick={onOpenSettings}
        >
          设置
        </button>
      </div>
      <div
        className={`popup-hero__actions${showSidePanelButton ? "" : " popup-hero__actions--compact"}`}
      >
        <AppToggle enabled={appEnabled} onToggle={onToggleApp} />
        <button
          type="button"
          className="btn btn-secondary btn-inline popup-example-btn"
          onClick={onOpenEnglishExample}
          title="打开英语新闻示例页面"
        >
          英语示例页面
        </button>
        {showSidePanelButton && (
          <button
            type="button"
            className="btn btn-secondary btn-inline popup-sidepanel-btn"
            onClick={onOpenSidePanel}
            disabled={sidePanelButtonDisabled}
            aria-label="打开侧边栏"
            title="打开侧边栏"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
              <path d="M14.5 4v16M17.5 8h.01M17.5 12h.01" />
            </svg>
            <span>侧栏</span>
          </button>
        )}
      </div>
      <button
        type="button"
        className={`popup-learning-mode-switch${
          learningModeEnabled ? " is-active" : ""
        }`}
        onClick={onToggleLearningMode}
        disabled={!learningModeSupported}
        aria-pressed={learningModeEnabled}
        title={
          learningModeSupported
            ? learningModeEnabled
              ? "关闭学习模式"
              : "开启学习模式"
            : "请先添加并选择支持句型分析的学习模型"
        }
      >
        <span className="popup-learning-mode-switch__copy">
          <span className="popup-learning-mode-switch__title">学习模式</span>
          <span className="popup-learning-mode-switch__hint">
            {learningModeSupported
              ? "翻译后显示句式分析"
              : "需要先设置学习模型"}
          </span>
        </span>
        <span className="popup-learning-mode-switch__state">
          {learningModeEnabled ? "已开启" : "已关闭"}
        </span>
        <span className="popup-learning-mode-switch__track" aria-hidden="true">
          <span className="popup-learning-mode-switch__thumb" />
        </span>
      </button>
    </header>
  );
}
