import { ChoiceGrid } from "./ChoiceGrid.jsx";
import { Panel } from "./Panel.jsx";

export function HoverTranslateScopePanel({
  options,
  value,
  onChange,
  showStatus = false,
  statusText,
  statusTone,
}) {
  return (
    <Panel
      title="悬停翻译范围"
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
    </Panel>
  );
}