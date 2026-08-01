import { useRef } from "react";
import { PROVIDER_OLLAMA } from "../../../shared/constants.js";
import {
  isChatGptProvider,
  isChromeAiProvider,
  isGitHubModelsProvider,
  isMiniMaxProvider,
} from "../../../shared/settings.js";
import { AutoSaveInputField } from "../common/AutoSaveField.jsx";
import {
  getConnectionResultClass,
  getMiniMaxConfig,
  isMiniMaxKeyMissing as checkMiniMaxKeyMissing,
} from "../../lib/homeTabUtils.js";
import { ChatGptAuthFields } from "./ChatGptAuthFields.jsx";
import { ChromeAiPanel } from "./ChromeAiPanel.jsx";
import { ConnectionTestField } from "./ConnectionTestField.jsx";
import { FIELD_IDS } from "./constants.js";
import { GitHubAuthFields } from "./GitHubAuthFields.jsx";
import { MiniMaxApiKeyField } from "./MiniMaxApiKeyField.jsx";
import { ProviderModelField } from "./ProviderModelField.jsx";

export function ProviderConfigFields({
  provider,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  testConnectionResult,
  updateConnectionStatus,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  modelDropdownRef,
  setOriginsModalOpen,
  onAvailabilityInvalidated,
  onChromeAiAvailabilityChange,
  showConnectionTest = true,
}) {
  const fallbackRef = useRef(settings);
  fallbackRef.current = settings;
  const currentSettingsRef = settingsRef || fallbackRef;
  const isMiniMax = isMiniMaxProvider(provider);
  const isGitHub = isGitHubModelsProvider(provider);
  const isChatGpt = isChatGptProvider(provider);
  const isChromeAi = isChromeAiProvider(provider);
  const minimaxConfig = getMiniMaxConfig(settings);
  const isMiniMaxKeyMissing = checkMiniMaxKeyMissing(settings);
  const isGitHubTokenMissing =
    isGitHub && !String(settings.githubDeviceToken || "").trim();
  const selectedModel = isMiniMax
    ? settings.minimaxModel
    : isGitHub
      ? settings.githubModel
      : isChatGpt
        ? settings.chatgptModel
        : settings.ollamaModel;
  const isModelMissing =
    !isChromeAi && !String(selectedModel || "").trim();
  const testConnectionClassName = getConnectionResultClass(
    testConnectionResult.tone,
  );
  const availableModels =
    settings.provider === provider ? models : [];

  return (
    <>
      {!isGitHub && !isChatGpt && !isChromeAi ? (
        <AutoSaveInputField
          id={FIELD_IDS.providerApiUrl}
          label="API 地址"
          tip={
            isMiniMax
              ? "MiniMax 接口地址，通常无需修改。"
              : "本地或远程 Ollama 服务地址。"
          }
          placeholder={
            isMiniMax
              ? minimaxConfig.urlPlaceholder
              : "http://127.0.0.1:11434"
          }
          value={isMiniMax ? settings.minimaxApiUrl : settings.ollamaUrl}
          settingKey={isMiniMax ? "minimaxApiUrl" : "ollamaUrl"}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={currentSettingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
        />
      ) : null}

      {isChromeAi ? (
        <ChromeAiPanel
          isChromeAi={isChromeAi}
          targetLang={settings.translateTargetLang}
          onAfterDownload={() => {
            void updateConnectionStatus(settings, {
              preserveTestMessage: false,
              updateBannerStatus: false,
              showTestPending: false,
            });
          }}
          onAvailabilityChange={onChromeAiAvailabilityChange}
        />
      ) : null}

      <MiniMaxApiKeyField
        isMiniMax={isMiniMax}
        minimaxConfig={minimaxConfig}
        isMiniMaxKeyMissing={isMiniMaxKeyMissing}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={currentSettingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />

      <GitHubAuthFields
        isGitHub={isGitHub}
        settings={settings}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={currentSettingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
        updateConnectionStatus={updateConnectionStatus}
        providerOverride={provider}
        onAvailabilityInvalidated={onAvailabilityInvalidated}
      />

      <ChatGptAuthFields
        isChatGpt={isChatGpt}
        settingsRef={currentSettingsRef}
        updateConnectionStatus={updateConnectionStatus}
        providerOverride={provider}
        onAvailabilityInvalidated={onAvailabilityInvalidated}
      />

      {!isChromeAi ? (
        <ProviderModelField
          isMiniMax={isMiniMax}
          isGitHub={isGitHub}
          isChatGpt={isChatGpt}
          settings={settings}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={currentSettingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
          models={availableModels}
          modelDropdownOpen={modelDropdownOpen}
          setModelDropdownOpen={setModelDropdownOpen}
          modelDropdownRef={modelDropdownRef}
          allowManualOllamaModel={provider === PROVIDER_OLLAMA}
        />
      ) : null}

      {showConnectionTest ? (
        <ConnectionTestField
          isMiniMax={isMiniMax}
          isGitHub={isGitHub}
          isChatGpt={isChatGpt}
          isChromeAi={isChromeAi}
          isMiniMaxKeyMissing={isMiniMaxKeyMissing}
          isGitHubTokenMissing={isGitHubTokenMissing}
          isModelMissing={isModelMissing}
          testConnectionClassName={testConnectionClassName}
          testConnectionResult={testConnectionResult}
          settingsRef={currentSettingsRef}
          connectionSettings={settings}
          updateConnectionStatus={updateConnectionStatus}
          setOriginsModalOpen={setOriginsModalOpen}
        />
      ) : null}
    </>
  );
}
