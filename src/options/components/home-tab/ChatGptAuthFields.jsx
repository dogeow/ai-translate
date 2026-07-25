import { ConditionalFields } from "../common/AutoSaveField.jsx";
import { tabsCreate } from "../../lib/chrome.js";
import { useChatGptDeviceLogin } from "./useChatGptDeviceLogin.js";

export function ChatGptAuthFields({
  isChatGpt,
  settingsRef,
  updateConnectionStatus,
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
  });

  return (
    <ConditionalFields condition={isChatGpt}>
      <div className="field">
        <label>ChatGPT 设备登录</label>
        <p className="hint" style={{ marginTop: 8 }}>
          使用 OpenAI 官方设备登录。令牌仅保存在当前设备，不会同步到浏览器账号。
        </p>

        {userCode ? (
          <div
            className="field-validation"
            style={{ marginTop: 10, fontSize: 18, letterSpacing: "0.08em" }}
          >
            验证码：<strong>{userCode}</strong>
          </div>
        ) : null}

        <div className="field-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deviceLoginBusy}
            onClick={() => {
              void startDeviceLogin();
            }}
          >
            {isLoggedIn ? "重新设备登录" : "开始设备登录"}
          </button>
          {deviceLoginBusy ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelDeviceLogin}
            >
              取消登录
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
              重新打开验证页
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deviceLoginBusy || !isLoggedIn}
            onClick={() => {
              void clearDeviceLogin();
            }}
          >
            退出登录
          </button>
        </div>

        <div
          className={`field-validation ${isLoggedIn ? "" : "field-validation--error"}`.trim()}
          style={{ marginTop: 8 }}
        >
          {deviceLoginStatus}
        </div>
      </div>
    </ConditionalFields>
  );
}
