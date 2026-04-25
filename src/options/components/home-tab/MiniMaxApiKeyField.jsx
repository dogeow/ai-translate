import {
  AutoSaveInputField,
  ConditionalFields,
} from "../common/AutoSaveField.jsx";
import { FIELD_IDS } from "./constants.js";

export function MiniMaxApiKeyField({
  isMiniMax,
  minimaxConfig,
  isMiniMaxKeyMissing,
  minimaxKeyMissingHint,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
}) {
  return (
    <ConditionalFields condition={isMiniMax}>
      <AutoSaveInputField
        id={FIELD_IDS.minimaxRegionApiKey}
        label={minimaxConfig.apiKeyLabel}
        placeholder={`输入${minimaxConfig.isGlobal ? "海外" : "国内"} sk- 开头的 MiniMax API Key`}
        value={minimaxConfig.apiKeyValue}
        settingKey={
          minimaxConfig.isGlobal ? "minimaxApiKeyGlobal" : "minimaxApiKeyCn"
        }
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
        error={isMiniMaxKeyMissing ? minimaxKeyMissingHint : null}
      />
    </ConditionalFields>
  );
}