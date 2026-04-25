export function ChoiceCard({
  value,
  title,
  hint,
  isActive,
  isCompact = false,
  onClick,
  onKeyDown,
  tabIndex,
}) {
  const className = `popup-choice-card${
    isCompact ? " popup-choice-card--compact" : ""
  }${isActive ? " is-active" : ""}`;

  return (
    <button
      type="button"
      className={className}
      onClick={() => onClick(value)}
      role="radio"
      aria-checked={isActive}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    >
      <div className="popup-choice-card__title">{title}</div>
      {hint ? <div className="popup-choice-card__hint">{hint}</div> : null}
    </button>
  );
}