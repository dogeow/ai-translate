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
      title="自动翻译模式"
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
    </Panel>
  );
}