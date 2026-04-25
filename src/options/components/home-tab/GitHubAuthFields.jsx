import {
  AutoSaveInputField,
  ConditionalFields,
} from "../common/AutoSaveField.jsx";
import { FIELD_IDS } from "./constants.js";
import { useGitHubDeviceLogin } from "./useGitHubDeviceLogin.js";

export function GitHubAuthFields({
  isGitHub,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  updateConnectionStatus,
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
  });

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