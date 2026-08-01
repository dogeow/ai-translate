export function Panel({
  title,
  hint,
  children,
  isSubtle = false,
  showStatus = false,
  statusText = "已保存中",
  statusTone = "neutral",
  className = "",
}) {
  const panelClassName = `popup-panel${
    isSubtle ? " popup-panel--subtle" : ""
  } ${className}`.trim();
  const statusClassName = `popup-status popup-status--${statusTone}`;
  const statusRole = statusTone === "error" ? "alert" : "status";
  const statusLive = statusTone === "error" ? "assertive" : "polite";

  return (
    <section className={panelClassName}>
      {(title || hint) && (
        <div className="popup-panel__header">
          <div>
            {title && <div className="popup-panel__title">{title}</div>}
            {hint && <div className="popup-panel__hint">{hint}</div>}
          </div>
          {showStatus && (
            <div
              className={statusClassName}
              role={statusRole}
              aria-live={statusLive}
            >
              {statusText}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
