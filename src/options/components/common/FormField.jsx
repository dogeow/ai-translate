/**
 * 通用表单字段组件
 * 提供统一的样式和行为
 */
import { FieldLabel } from "./InfoTip.jsx";

/**
 * 输入框字段组件
 */
export function InputField({
  id,
  label,
  type = "text",
  value,
  placeholder,
  onChange,
  onBlur,
  error,
  tip,
  className = "",
  ...props
}) {
  return (
    <div className="field">
      {label && (
        <FieldLabel htmlFor={id} tip={tip}>
          {label}
        </FieldLabel>
      )}
      <input
        id={id}
        type={type}
        className={`field-input ${className}`}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={error ? "true" : "false"}
        {...props}
      />
      {error && (
        <div className="field-validation field-validation--error">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * 选择框字段组件
 */
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  tip,
  className = "",
  ...props
}) {
  return (
    <div className="field">
      {label && (
        <FieldLabel htmlFor={id} tip={tip}>
          {label}
        </FieldLabel>
      )}
      <select
        id={id}
        className={`select ${className}`}
        value={value}
        onChange={onChange}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * 单选按钮组件
 */
export function RadioChoice({
  name,
  value,
  checked,
  onChange,
  title,
  description,
}) {
  return (
    <label className="choice-item">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="choice-item__title">{title}</span>
      {description && (
        <span className="choice-item__desc">{description}</span>
      )}
    </label>
  );
}

/**
 * 单选按钮组字段
 */
export function RadioGroup({
  name,
  value,
  onChange,
  options,
  label,
}) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="choice-list">
        {options.map((option) => (
          <RadioChoice
            key={option.value}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            title={option.title}
            description={option.description || option.hint}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 开关组件
 */
export function Switch({
  id,
  label,
  checked,
  onChange,
  className = "",
}) {
  return (
    <div className={`switch-field ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="switch-input"
      />
    </div>
  );
}
