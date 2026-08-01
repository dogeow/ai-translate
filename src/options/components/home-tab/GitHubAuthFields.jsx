import {
  AutoSaveInputField,
  ConditionalFields,
} from "../common/AutoSaveField.jsx";
import { FIELD_IDS } from "./constants.js";
import { useGitHubDeviceLogin } from "./useGitHubDeviceLogin.js";
import { FieldLabel } from "../common/InfoTip.jsx";

export function GitHubAuthFields({
  isGitHub,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  updateConnectionStatus,
  providerOverride = "",
}) {
  const {
    deviceLoginStatus,
    deviceLoginBusy,
    startDeviceLogin,
    clearDeviceLogin,
  } = useGitHubDeviceLogin({
    settingsRef,
    updateSettings,
    persistSettings,
    updateConnectionStatus,
    providerOverride,
  });

  return (
    <ConditionalFields condition={isGitHub}>
      <AutoSaveInputField
        id={FIELD_IDS.githubOAuthClientId}
        label="OAuth Client ID"
        tip="填写已启用 Device Flow 的 GitHub OAuth App Client ID。"
        placeholder="输入 Client ID"
        value={settings.githubOAuthClientId}
        settingKey="githubOAuthClientId"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />

      <div className="field provider-auth">
        <div className="provider-auth__heading">
          <FieldLabel tip="设备授权完成后，令牌只保存在扩展设置中。">
            GitHub 登录
          </FieldLabel>
          <span
            className={`provider-auth__status ${settings.githubDeviceToken ? "provider-auth__status--ok" : ""}`.trim()}
          >
            {deviceLoginBusy
              ? "登录中"
              : settings.githubDeviceToken
                ? "已登录"
                : "未登录"}
          </span>
        </div>
        <div className="field-row provider-auth__actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deviceLoginBusy}
            onClick={() => {
              void startDeviceLogin();
            }}
          >
            {deviceLoginBusy ? "登录中…" : "登录"}
          </button>
          {settings.githubDeviceToken ? (
            <button
              type="button"
              className="btn btn-secondary provider-auth__logout"
              disabled={deviceLoginBusy}
              onClick={() => {
                void clearDeviceLogin();
              }}
            >
              退出
            </button>
          ) : null}
        </div>
        {deviceLoginStatus ? (
          <div className="field-validation">{deviceLoginStatus}</div>
        ) : null}
      </div>
    </ConditionalFields>
  );
}
