import { useState } from "react";
import {
  pollGitHubDeviceToken,
  requestGitHubDeviceCode,
} from "../../../shared/github-models-api.js";
import { tabsCreate } from "../../lib/chrome.js";

export function useGitHubDeviceLogin({
  settingsRef,
  updateSettings,
  persistSettings,
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

  return {
    deviceLoginStatus,
    deviceLoginBusy,
    startDeviceLogin,
    clearDeviceLogin,
  };
}