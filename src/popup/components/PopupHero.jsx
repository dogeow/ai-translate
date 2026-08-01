import { AppToggle } from "./AppToggle.jsx";

export function PopupHero({
  surface = "popup",
  appEnabled,
  onToggleApp,
  onOpenSettings,
  showSidePanelButton = false,
  sidePanelButtonDisabled = false,
  onOpenSidePanel,
}) {
  const isSidePanel = surface === "sidepanel";

  return (
    <header
      className={`popup-hero${isSidePanel ? " popup-hero--sidepanel" : ""}`}
    >
      <div className="popup-hero__title-group">
        {isSidePanel ? (
          <span className="popup-hero__surface-label">翻译功能</span>
        ) : (
          <h1>英语学习和AI翻译</h1>
        )}
      </div>
      <div
        className={`popup-hero__actions${showSidePanelButton ? "" : " popup-hero__actions--compact"}`}
      >
        <AppToggle enabled={appEnabled} onToggle={onToggleApp} />
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
        <button
          type="button"
          className="btn btn-secondary btn-inline popup-settings-btn"
          onClick={onOpenSettings}
        >
          设置
        </button>
      </div>
    </header>
  );
}
