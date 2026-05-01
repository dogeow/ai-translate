import { useRef } from "react";
import {
  LANG_OPTIONS,
  MINIMAX_REGION_CN,
  MINIMAX_REGION_GLOBAL,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";
import {
  getDefaultMiniMaxApiUrlByRegion,
  isMiniMaxProvider,
  isGitHubModelsProvider,
  isChromeAiProvider,
} from "../../shared/settings.js";
import { Card } from "./common/Card.jsx";
import {
  AutoSaveInputField,
  AutoSaveSelectField,
} from "./common/AutoSaveField.jsx";
import { useOutsideClick } from "../hooks/useOutsideClick.js";
import {
  getConnectionResultClass,
  getMiniMaxConfig,
  isMiniMaxKeyMissing as checkMiniMaxKeyMissing,
} from "../lib/homeTabUtils.js";
import { ChromeAiPanel } from "./home-tab/ChromeAiPanel.jsx";
import { ConnectionTestField } from "./home-tab/ConnectionTestField.jsx";
import { FIELD_IDS } from "./home-tab/constants.js";
import { GitHubAuthFields } from "./home-tab/GitHubAuthFields.jsx";
import { MiniMaxApiKeyField } from "./home-tab/MiniMaxApiKeyField.jsx";
import { ProviderModelField } from "./home-tab/ProviderModelField.jsx";

export function HomeTab({
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  setOriginsModalOpen,
  testConnectionResult,
  updateConnectionStatus,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
}) {
  const modelDropdownRef = useRef(null);
  useOutsideClick(
    modelDropdownRef,
    () => setModelDropdownOpen(false),
    modelDropdownOpen,
  );
  const isMiniMax = isMiniMaxProvider(settings.provider);
  const isGitHub = isGitHubModelsProvider(settings.provider);
  const isChromeAi = isChromeAiProvider(settings.provider);
  const testConnectionClassName = getConnectionResultClass(
    testConnectionResult.tone,
  );
  const minimaxConfig = getMiniMaxConfig(settings);
  const isMiniMaxKeyMissing = checkMiniMaxKeyMissing(settings);
  const isGitHubTokenMissing =
    isGitHub && !String(settings.githubDeviceToken || "").trim();
  const minimaxKeyMissingHint = `请先填写${minimaxConfig.apiKeyLabel}`;

  const handleProviderChange = (event, newProvider) => {
    const nextSettings = {
      ...settingsRef.current,
      provider: newProvider,
    };
    if (
      newProvider === PROVIDER_MINIMAX_CN ||
      newProvider === PROVIDER_MINIMAX_GLOBAL
    ) {
      const region =
        newProvider === PROVIDER_MINIMAX_GLOBAL
          ? MINIMAX_REGION_GLOBAL
          : MINIMAX_REGION_CN;
      nextSettings.minimaxRegion = region;
      nextSettings.minimaxApiUrl = getDefaultMiniMaxApiUrlByRegion(region);
    }
    updateSettings(() => nextSettings, "now");
    void updateConnectionStatus(nextSettings, {
      preserveTestMessage: false,
      updateBannerStatus: false,
      showTestPending: true,
    });
  };

  return (
    <>
      <Card title="翻译引擎">
        <AutoSaveSelectField
          id={FIELD_IDS.provider}
          label="API 厂家"
          value={settings.provider}
          options={TRANSLATE_PROVIDER_OPTIONS}
          settingKey="provider"
          updateSettings={updateSettings}
          onChange={handleProviderChange}
        />

        {!isGitHub && !isChromeAi ? (
          <AutoSaveInputField
            id={FIELD_IDS.providerApiUrl}
            label={isMiniMax ? "MiniMax API 地址" : "Ollama API 地址"}
            placeholder={
              isMiniMax ? minimaxConfig.urlPlaceholder : "http://127.0.0.1:11434"
            }
            value={isMiniMax ? settings.minimaxApiUrl : settings.ollamaUrl}
            settingKey={isMiniMax ? "minimaxApiUrl" : "ollamaUrl"}
            updateSettings={updateSettings}
            persistSettings={persistSettings}
            settingsRef={settingsRef}
            showAutoSaveStatus={showAutoSaveStatus}
          />
        ) : null}

        {isChromeAi ? (
          <>
            <p className="hint" style={{ marginTop: 8 }}>
              使用 Chrome 内置翻译模型，免费、离线、无 API Key。需 Chrome 138+
              （含 Edge）。Firefox 暂不支持。
            </p>
            <ChromeAiPanel
              isChromeAi={isChromeAi}
              targetLang={settings.translateTargetLang}
              onAfterDownload={() => {
                void updateConnectionStatus(settingsRef.current, {
                  preserveTestMessage: false,
                  updateBannerStatus: true,
                  showTestPending: false,
                });
              }}
            />
          </>
        ) : null}

        <MiniMaxApiKeyField
          isMiniMax={isMiniMax}
          minimaxConfig={minimaxConfig}
          isMiniMaxKeyMissing={isMiniMaxKeyMissing}
          minimaxKeyMissingHint={minimaxKeyMissingHint}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
        />

        <GitHubAuthFields
          isGitHub={isGitHub}
          settings={settings}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
          updateConnectionStatus={updateConnectionStatus}
        />

        {!isChromeAi ? (
          <ProviderModelField
            isMiniMax={isMiniMax}
            isGitHub={isGitHub}
            settings={settings}
            updateSettings={updateSettings}
            persistSettings={persistSettings}
            settingsRef={settingsRef}
            showAutoSaveStatus={showAutoSaveStatus}
            models={models}
            modelDropdownOpen={modelDropdownOpen}
            setModelDropdownOpen={setModelDropdownOpen}
            modelDropdownRef={modelDropdownRef}
          />
        ) : null}

        {!isChromeAi ? (
          <ConnectionTestField
            isMiniMax={isMiniMax}
            isGitHub={isGitHub}
            isChromeAi={isChromeAi}
            isMiniMaxKeyMissing={isMiniMaxKeyMissing}
            isGitHubTokenMissing={isGitHubTokenMissing}
            testConnectionClassName={testConnectionClassName}
            testConnectionResult={testConnectionResult}
            settingsRef={settingsRef}
            updateConnectionStatus={updateConnectionStatus}
            setOriginsModalOpen={setOriginsModalOpen}
          />
        ) : null}
      </Card>

      <div className="card">
        <h2>翻译偏好</h2>
        <div className="field">
          <label htmlFor={FIELD_IDS.translateTargetLang}>默认翻译语言</label>
          <select
            id={FIELD_IDS.translateTargetLang}
            className="select"
            value={settings.translateTargetLang}
            onChange={(event) => {
              updateSettings(
                { translateTargetLang: event.target.value },
                "now",
              );
            }}
          >
            {LANG_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
