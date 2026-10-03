import { AppToggle } from "./AppToggle.jsx";

export function PopupHero({ appEnabled, onToggleApp, onOpenSettings }) {
  return (
    <header className="popup-hero">
      <div className="popup-hero__brand">
        <span className="popup-hero__mark" aria-hidden="true">
          译
        </span>
        <div>
          <h1>AI 翻译</h1>
          <p className="popup-hero__subtitle">英语学习 · 网页助手</p>
        </div>
      </div>
      <div className="popup-hero__controls">
        <AppToggle enabled={appEnabled} onToggle={onToggleApp} />
        <button
          type="button"
          className="popup-settings-btn"
          onClick={onOpenSettings}
          aria-label="打开设置"
          title="设置"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9.5 3.5h5l.6 2.3 2 1.2 2.3-.6 2.5 4.3-1.7 1.6v2.3l1.7 1.6-2.5 4.3-2.3-.6-2 1.2-.6 2.3h-5L8.9 21l-2-1.2-2.3.6-2.5-4.3 1.7-1.6v-2.3l-1.7-1.6 2.5-4.3 2.3.6 2-1.2z"
              transform="translate(0 -1.5) scale(1 .94)"
            />
            <circle cx="12" cy="11" r="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
