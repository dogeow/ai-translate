import { ChoiceGrid } from "./ChoiceGrid.jsx";
import { Panel } from "./Panel.jsx";

export function AutoTranslateModePanel({
  options,
  value,
  onChange,
  showStatus = false,
  statusText,
  statusTone,
}) {
  return (
    <Panel
      title="取词翻译"
      className="popup-panel--mode"
      showStatus={showStatus}
      statusText={statusText}
      statusTone={statusTone}
    >
      <ChoiceGrid
        options={options}
        value={value}
        onChange={onChange}
        ariaLabel="自动翻译模式"
      />
      <p className="popup-mode-hint">
        {value === "hover"
          ? "鼠标停在文字上，即可查看翻译。"
          : value === "selection"
            ? "双击翻译单词，三击翻译整段。"
            : "选中文字后，使用翻译快捷键。"}
      </p>
    </Panel>
  );
}
