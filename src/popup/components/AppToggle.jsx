export function AppToggle({
  enabled,
  onToggle,
}) {
  const className = `popup-app-toggle${enabled ? " is-active" : ""}`;
  const label = enabled ? "关闭应用" : "开启应用";
  const statusText = enabled ? "已开启" : "已关闭";

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      <span className="popup-app-toggle__track" aria-hidden="true">
        <span className="popup-app-toggle__thumb" />
      </span>
      <span className="popup-app-toggle__text">{statusText}</span>
    </button>
  );
}