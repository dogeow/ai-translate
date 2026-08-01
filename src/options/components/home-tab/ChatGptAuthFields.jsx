import { ConditionalFields } from "../common/AutoSaveField.jsx";
import { tabsCreate } from "../../lib/chrome.js";
import { useChatGptDeviceLogin } from "./useChatGptDeviceLogin.js";
import { FieldLabel } from "../common/InfoTip.jsx";

export function ChatGptAuthFields({
  isChatGpt,
  settingsRef,
  updateConnectionStatus,
  providerOverride = "",
  onAvailabilityInvalidated,
}) {
  const {
    deviceLoginStatus,
    deviceLoginBusy,
    isLoggedIn,
    userCode,
    verificationUri,
    startDeviceLogin,
    cancelDeviceLogin,
    clearDeviceLogin,
  } = useChatGptDeviceLogin({
    isChatGpt,
    settingsRef,
    updateConnectionStatus,
    providerOverride,
    onAvailabilityInvalidated,
  });
  const isDefaultStatus =
    deviceLoginStatus === "正在读取登录状态…" ||
    deviceLoginStatus === "尚未登录 ChatGPT。";
  const showStatus = !isDefaultStatus && Boolean(deviceLoginStatus);
  const statusIsError = /失败|错误/.test(deviceLoginStatus);

  return (
    <ConditionalFields condition={isChatGpt}>
      <div className="field provider-auth">
        <div className="provider-auth__heading">
          <FieldLabel tip="使用 OpenAI 官方设备登录。令牌只保存在当前设备，不会同步到浏览器账号。">
            ChatGPT 登录
          </FieldLabel>
          <span
            className={`provider-auth__status ${isLoggedIn ? "provider-auth__status--ok" : ""}`.trim()}
          >
            {deviceLoginBusy ? "登录中" : isLoggedIn ? "已登录" : "未登录"}
          </span>
        </div>

        {userCode ? (
          <div className="provider-auth__code">
            <span>验证码</span>
            <strong>{userCode}</strong>
          </div>
        ) : null}

        <div className="field-row provider-auth__actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deviceLoginBusy}
            onClick={() => {
              void startDeviceLogin();
            }}
          >
            {deviceLoginBusy ? "登录中…" : isLoggedIn ? "重新登录" : "登录"}
          </button>
          {deviceLoginBusy ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelDeviceLogin}
            >
              取消
            </button>
          ) : null}
          {verificationUri ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void tabsCreate(verificationUri);
              }}
            >
              验证页
            </button>
          ) : null}
          {isLoggedIn ? (
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

        {showStatus ? (
          <div
            className={`field-validation ${statusIsError ? "field-validation--error" : ""}`.trim()}
          >
            {deviceLoginStatus}
          </div>
        ) : null}
      </div>
    </ConditionalFields>
  );
}
