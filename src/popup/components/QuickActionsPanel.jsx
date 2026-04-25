import { TRANSLATE_PROVIDER_OPTIONS } from "../../shared/constants.js";
import { Panel } from "./Panel.jsx";

const PROVIDER_SELECT_ID = "popup-provider-select";

export function QuickActionsPanel({
  appEnabled,
  isStartingPageTranslate,
  pageTranslateStatus,
  onStartPageTranslate,
  provider,
  onProviderChange,
  showStatus = false,
  statusText,
  statusTone,
}) {
  return (
    <Panel
      title="快速操作"
      isSubtle
      showStatus={showStatus}
      statusText={statusText}
      statusTone={statusTone}
    >
      <button
        type="button"
        className="btn btn-primary popup-page-translate-btn"
        onClick={onStartPageTranslate}
        disabled={!appEnabled || isStartingPageTranslate}
      >
        {isStartingPageTranslate ? "启动中..." : "开始页面翻译"}
      </button>
      {pageTranslateStatus && (
        <div className="popup-page-translate-status" role="status">
          {pageTranslateStatus}
        </div>
      )}
      <div className="popup-field">
        <label className="popup-field__label" htmlFor={PROVIDER_SELECT_ID}>
          API 厂家
        </label>
        <select
          id={PROVIDER_SELECT_ID}
          className="popup-provider-select"
          value={provider}
          onChange={(event) => onProviderChange(event.target.value)}
        >
          {TRANSLATE_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </Panel>
  );
}