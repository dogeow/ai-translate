import { AppToggle } from "./AppToggle.jsx";

export function PopupHero({
  appEnabled,
  onToggleApp,
  onOpenSettings,
}) {
  return (
    <header className="popup-hero">
      <div className="popup-hero__title-group">
        <h1>Ollama 翻译</h1>
        <AppToggle
          enabled={appEnabled}
          onToggle={onToggleApp}
        />
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-inline popup-settings-btn"
        onClick={onOpenSettings}
      >
        设置
      </button>
    </header>
  );
}