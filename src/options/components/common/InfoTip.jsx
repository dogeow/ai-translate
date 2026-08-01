import { useId } from "react";

export function InfoTip({ text, label = "查看说明" }) {
  const tooltipId = useId();
  if (!text) return null;

  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip__trigger"
        aria-label={label}
        aria-describedby={tooltipId}
      >
        ?
      </button>
      <span id={tooltipId} className="info-tip__content" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function FieldLabel({ children, htmlFor, tip }) {
  return (
    <span className="field-label-row">
      <label htmlFor={htmlFor}>{children}</label>
      <InfoTip text={tip} />
    </span>
  );
}
