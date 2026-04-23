import { useRef, useState } from "react";
import {
  LANG_OPTIONS,
  MINIMAX_REGION_CN,
  MINIMAX_REGION_GLOBAL,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  DEFAULT_GITHUB_MODEL,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";
import {
  getDefaultMiniMaxApiUrlByRegion,
  isMiniMaxProvider,
  isGitHubModelsProvider,
} from "../../shared/settings.js";
import {
  pollGitHubDeviceToken,
  requestGitHubDeviceCode,
} from "../../shared/github-models-api.js";
import { Card } from "./common/Card.jsx";
import {
  AutoSaveInputField,
  AutoSaveSelectField,
  ConditionalFields,
} from "./common/AutoSaveField.jsx";
import { ModelDropdown } from "./ModelDropdown.jsx";
import { useOutsideClick } from "../hooks/useOutsideClick.js";
import { tabsCreate } from "../lib/chrome.js";
import {
  getConnectionResultClass,
  getMiniMaxConfig,
  isMiniMaxKeyMissing as checkMiniMaxKeyMissing,
} from "../lib/homeTabUtils.js";

const FIELD_IDS = Object.freeze({
  provider: "provider",
  providerApiUrl: "providerApiUrl",
  minimaxRegionApiKey: "minimaxRegionApiKey",
  githubOAuthClientId: "githubOAuthClientId",
  providerModel: "providerModel",
  translateTargetLang: "translateTargetLang",
});

function MiniMaxApiKeyField({
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

function GitHubAuthFields({
  isGitHub,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  updateConnectionStatus,
}) {
  const [deviceLoginStatus, setDeviceLoginStatus] = useState("");
  const [deviceLoginBusy, setDeviceLoginBusy] = useState(false);

  async function startDeviceLogin() {
    const clientId = String(settingsRef.current.githubOAuthClientId || "").trim();
    if (!clientId) {
      setDeviceLoginStatus("请先填写 GitHub OAuth App Client ID。");
      return;
    }

    setDeviceLoginBusy(true);
    setDeviceLoginStatus("正在申请设备验证码…");

    try {
      const device = await requestGitHubDeviceCode(clientId);
      const verificationUri = String(device?.verification_uri || "").trim();
      const userCode = String(device?.user_code || "").trim();

      if (verificationUri) {
        await tabsCreate(verificationUri);
      }

      setDeviceLoginStatus(
        userCode
          ? `请在 GitHub 页面输入验证码 ${userCode}，授权完成后会自动保存。`
          : "请在新打开的 GitHub 页面完成授权。",
      );

      const accessToken = await pollGitHubDeviceToken({
        clientId,
        deviceCode: device?.device_code,
        interval: device?.interval,
      });

      const nextSettings = {
        ...settingsRef.current,
        githubDeviceToken: accessToken,
      };
      updateSettings({ githubDeviceToken: accessToken }, "now");
      await persistSettings(nextSettings, { force: true });
      setDeviceLoginStatus("设备登录成功，令牌已保存。");
      await updateConnectionStatus(nextSettings, {
        preserveTestMessage: false,
        updateBannerStatus: false,
        showTestPending: true,
      });
    } catch (error) {
      setDeviceLoginStatus(error?.message || "GitHub 设备登录失败。");
    } finally {
      setDeviceLoginBusy(false);
    }
  }

  async function clearDeviceLogin() {
    const nextSettings = {
      ...settingsRef.current,
      githubDeviceToken: "",
    };
    updateSettings({ githubDeviceToken: "" }, "now");
    await persistSettings(nextSettings, { force: true, silent: true });
    setDeviceLoginStatus("已清除设备登录令牌。");
  }

  return (
    <ConditionalFields condition={isGitHub}>
      <AutoSaveInputField
        id={FIELD_IDS.githubOAuthClientId}
        label="GitHub OAuth App Client ID"
        placeholder="输入已启用 Device Flow 的 GitHub OAuth App Client ID"
        value={settings.githubOAuthClientId}
        settingKey="githubOAuthClientId"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />

      <div className="field">
        <label>设备登录</label>
        <div className="field-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deviceLoginBusy}
            onClick={() => {
              void startDeviceLogin();
            }}
          >
            {deviceLoginBusy ? "登录中…" : "开始设备登录"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deviceLoginBusy || !settings.githubDeviceToken}
            onClick={() => {
              void clearDeviceLogin();
            }}
          >
            清除登录
          </button>
        </div>
        <div
          className={`field-validation ${settings.githubDeviceToken ? "" : "field-validation--error"}`.trim()}
          style={{ marginTop: 8 }}
        >
          {deviceLoginStatus ||
            (settings.githubDeviceToken
              ? "已保存设备登录令牌。"
              : "尚未完成设备登录。")}
        </div>
      </div>
    </ConditionalFields>
  );
}

function ProviderModelField({
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
            onToggle={() => setModelDropdownOpen((v) => !v)}
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
        onToggle={() => setModelDropdownOpen((v) => !v)}
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

function ConnectionTestField({
  isMiniMax,
  isGitHub,
  isMiniMaxKeyMissing,
  isGitHubTokenMissing,
  testConnectionClassName,
  testConnectionResult,
  settingsRef,
  updateConnectionStatus,
  setOriginsModalOpen,
}) {
  return (
    <div className="field">
      <div className="field-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isMiniMaxKeyMissing || isGitHubTokenMissing}
          onClick={async () => {
            await updateConnectionStatus(settingsRef.current, {
              preserveTestMessage: false,
              updateBannerStatus: false,
              showTestPending: true,
            });
          }}
        >
          测试连接
        </button>
        <span className={testConnectionClassName}>{testConnectionResult.text}</span>
        {!isMiniMax && !isGitHub && testConnectionResult.showAction ? (
          <button
            type="button"
            className="btn btn-secondary test-result-action"
            onClick={() => setOriginsModalOpen(true)}
          >
            查看解决方法
          </button>
        ) : null}
      </div>
    </div>
  );
}

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

        {!isGitHub ? (
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

        <ConnectionTestField
          isMiniMax={isMiniMax}
          isGitHub={isGitHub}
          isMiniMaxKeyMissing={isMiniMaxKeyMissing}
          isGitHubTokenMissing={isGitHubTokenMissing}
          testConnectionClassName={testConnectionClassName}
          testConnectionResult={testConnectionResult}
          settingsRef={settingsRef}
          updateConnectionStatus={updateConnectionStatus}
          setOriginsModalOpen={setOriginsModalOpen}
        />
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
