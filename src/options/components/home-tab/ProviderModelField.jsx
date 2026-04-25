import { DEFAULT_GITHUB_MODEL } from "../../../shared/constants.js";
import { ModelDropdown } from "../ModelDropdown.jsx";
import { AutoSaveInputField } from "../common/AutoSaveField.jsx";
import { FIELD_IDS } from "./constants.js";

export function ProviderModelField({
  isMiniMax,
  isGitHub,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  modelDropdownRef,
}) {
  if (isMiniMax) {
    return (
      <AutoSaveInputField
        id={FIELD_IDS.providerModel}
        label="模型"
        placeholder="输入 MiniMax 模型，例如 MiniMax-M2.5-highspeed"
        value={settings.minimaxModel}
        settingKey="minimaxModel"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    );
  }

  if (isGitHub) {
    if (models.length > 0) {
      return (
        <div className="field">
          <label id={`${FIELD_IDS.providerModel}-label`}>模型</label>
          <ModelDropdown
            models={models}
            selectedValue={settings.githubModel}
            disabled={false}
            isOpen={modelDropdownOpen}
            onToggle={() => setModelDropdownOpen((value) => !value)}
            onSelect={(name) => {
              updateSettings({ githubModel: name }, "now");
              void persistSettings(settingsRef.current);
              setModelDropdownOpen(false);
            }}
            dropdownRef={modelDropdownRef}
          />
        </div>
      );
    }

    return (
      <AutoSaveInputField
        id={FIELD_IDS.providerModel}
        label="模型"
        placeholder={DEFAULT_GITHUB_MODEL}
        value={settings.githubModel}
        settingKey="githubModel"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    );
  }

  return (
    <div className="field">
      <label id={`${FIELD_IDS.providerModel}-label`}>模型</label>
      <ModelDropdown
        models={models}
        selectedValue={settings.ollamaModel}
        disabled={models.length === 0}
        isOpen={modelDropdownOpen}
        onToggle={() => setModelDropdownOpen((value) => !value)}
        onSelect={(name) => {
          updateSettings({ ollamaModel: name }, "now");
          void persistSettings(settingsRef.current);
          setModelDropdownOpen(false);
        }}
        dropdownRef={modelDropdownRef}
      />
    </div>
  );
}