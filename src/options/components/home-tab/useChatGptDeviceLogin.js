import { useEffect, useRef, useState } from "react";
import {
  completeChatGptDeviceLogin,
  getChatGptAuthSummary,
  logoutChatGpt,
  requestChatGptDeviceCode,
} from "../../../shared/chatgpt-auth.js";
import { tabsCreate } from "../../lib/chrome.js";

function formatLoggedInStatus(summary) {
  if (!summary?.isLoggedIn) return "尚未登录 ChatGPT。";
  const identity = summary.email || "ChatGPT 账号";
  const plan = summary.planType ? ` · ${summary.planType}` : "";
  return `已登录：${identity}${plan}`;
}

export function useChatGptDeviceLogin({
  isChatGpt,
  settingsRef,
  updateConnectionStatus,
  providerOverride = "",
  onAvailabilityInvalidated,
}) {
  const [deviceLoginStatus, setDeviceLoginStatus] =
    useState("正在读取登录状态…");
  const [deviceLoginBusy, setDeviceLoginBusy] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!isChatGpt) return undefined;
    let active = true;
    void getChatGptAuthSummary({ refresh: true }).then((summary) => {
      if (!active) return;
      setIsLoggedIn(!!summary.isLoggedIn);
      setDeviceLoginStatus(formatLoggedInStatus(summary));
    });
    return () => {
      active = false;
      abortControllerRef.current?.abort();
    };
  }, [isChatGpt]);

  async function startDeviceLogin() {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setDeviceLoginBusy(true);
    setUserCode("");
    setVerificationUri("");
    setDeviceLoginStatus("正在申请 ChatGPT 设备验证码…");

    try {
      const device = await requestChatGptDeviceCode({
        signal: controller.signal,
      });
      setUserCode(device.userCode);
      setVerificationUri(device.verificationUri);
      setDeviceLoginStatus(
        `请在打开的 ChatGPT 页面输入验证码 ${device.userCode}，授权后会自动完成登录。`,
      );
      await tabsCreate(device.verificationUri).catch(() => null);

      const auth = await completeChatGptDeviceLogin(device, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const summary = {
        isLoggedIn: true,
        email: auth.email,
        planType: auth.planType,
      };
      setIsLoggedIn(true);
      setUserCode("");
      setVerificationUri("");
      setDeviceLoginStatus(formatLoggedInStatus(summary));
      await updateConnectionStatus(
        {
          ...settingsRef.current,
          provider: providerOverride || settingsRef.current.provider,
        },
        {
          preserveTestMessage: false,
          updateBannerStatus: true,
          showTestPending: true,
        },
      );
    } catch (error) {
      if (controller.signal.aborted) {
        setDeviceLoginStatus("已取消 ChatGPT 设备登录。");
      } else {
        setDeviceLoginStatus(
          error?.message || "ChatGPT 设备登录失败，请重试。",
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setDeviceLoginBusy(false);
      }
    }
  }

  function cancelDeviceLogin() {
    abortControllerRef.current?.abort();
  }

  async function clearDeviceLogin() {
    cancelDeviceLogin();
    setDeviceLoginBusy(true);
    try {
      await logoutChatGpt();
      onAvailabilityInvalidated?.();
      setIsLoggedIn(false);
      setUserCode("");
      setVerificationUri("");
      setDeviceLoginStatus("已退出 ChatGPT，设备登录令牌已从本机清除。");
      await updateConnectionStatus(
        {
          ...settingsRef.current,
          provider: providerOverride || settingsRef.current.provider,
        },
        {
          preserveTestMessage: false,
          updateBannerStatus: true,
          showTestPending: false,
        },
      );
    } catch (error) {
      setDeviceLoginStatus(
        error?.message || "清除 ChatGPT 登录状态失败。",
      );
    } finally {
      setDeviceLoginBusy(false);
    }
  }

  return {
    deviceLoginStatus,
    deviceLoginBusy,
    isLoggedIn,
    userCode,
    verificationUri,
    startDeviceLogin,
    cancelDeviceLogin,
    clearDeviceLogin,
  };
}
