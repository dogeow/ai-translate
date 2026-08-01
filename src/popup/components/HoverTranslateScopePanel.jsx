import { ChoiceGrid } from "./ChoiceGrid.jsx";
import { Panel } from "./Panel.jsx";

export function HoverTranslateScopePanel({
  options,
  value,
  onChange,
  modifierOptions,
  modifierValue,
  onModifierChange,
  showStatus = false,
  statusText,
  statusTone,
}) {
  const selectedModifier = modifierOptions.find(
    (option) => option.value === modifierValue,
  );
  const modifierHint =
    modifierValue === "none"
      ? "临时切换已关闭"
      : `按住 ${selectedModifier?.label || "Option / Alt"} 悬停可临时切换`;

  return (
    <Panel
      title="悬停翻译范围"
      hint={modifierHint}
      isSubtle
      showStatus={showStatus}
      statusText={statusText}
      statusTone={statusTone}
    >
      <ChoiceGrid
        options={options}
        value={value}
        onChange={onChange}
        isCompact
        ariaLabel="悬停翻译范围"
      />
      <label className="popup-hover-modifier">
        <span>临时切换键</span>
        <select
          value={modifierValue}
          onChange={(event) => onModifierChange(event.target.value)}
          aria-label="悬停翻译临时切换键"
        >
          {modifierOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </Panel>
  );
}
