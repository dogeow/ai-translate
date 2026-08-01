export function PopupModelField({
  id,
  label,
  value,
  onChange,
  options = [],
  isLoading = false,
  onOpenSetup,
  className = "",
}) {
  const selectedValue = options.some((option) => option.value === value)
    ? value
    : options[0]?.value || "";
  const fieldClassName = `popup-field${
    className ? ` ${className}` : ""
  }`;

  return (
    <div className={fieldClassName}>
      <label className="popup-field__label" htmlFor={id}>
        {label}
      </label>
      {isLoading ? (
        <button
          id={id}
          type="button"
          className="popup-provider-select popup-provider-select--loading"
          disabled
        >
          正在检测可用模型…
        </button>
      ) : options.length > 0 ? (
        <select
          id={id}
          className="popup-provider-select"
          value={selectedValue}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <button
          id={id}
          type="button"
          className="popup-provider-empty"
          onClick={onOpenSetup}
        >
          <span>暂无可用模型</span>
          <strong>前往新增</strong>
        </button>
      )}
    </div>
  );
}
