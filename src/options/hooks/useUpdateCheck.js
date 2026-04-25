import { useCallback, useEffect, useState } from "react";
import { createDefaultUpdateState, UPDATE_STATE_KEY } from "../../shared/update.js";
import {
  runtimeSendMessage,
  storageLocalGet,
  storageOnChanged,
  tabsCreate,
} from "../lib/chrome.js";

/**
 * 管理扩展更新检查状态的 hook
 */
export function useUpdateCheck() {
  const currentVersion = chrome.runtime.getManifest().version;
  const [updateState, setUpdateState] = useState(createDefaultUpdateState(currentVersion));

  const loadUpdateState = useCallback(async () => {
    const storedUpdateState = await storageLocalGet(UPDATE_STATE_KEY);
    setUpdateState({
      ...createDefaultUpdateState(currentVersion),
      ...(storedUpdateState || {}),
    });
  }, [currentVersion]);

  useEffect(() => {
    function handleStorageChanged(changes, areaName) {
      if (areaName !== "local" || !(UPDATE_STATE_KEY in changes)) return;
      setUpdateState({
        ...createDefaultUpdateState(currentVersion),
        ...(changes[UPDATE_STATE_KEY].newValue || {}),
      });
    }

    return storageOnChanged(handleStorageChanged);
  }, [currentVersion]);

  const runExtensionUpdateCheck = useCallback(async () => {
    setUpdateState((previous) => ({
      ...previous,
      status: "checking",
      checkedAt: Date.now(),
      error: "",
    }));

    try {
      const response = await runtimeSendMessage({
        action: "checkExtensionUpdate",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "检查失败");
      }

      setUpdateState({
        ...createDefaultUpdateState(currentVersion),
        ...(response.state || {}),
      });
    } catch (error) {
      setUpdateState((previous) => ({
        ...previous,
        status: "error",
        checkedAt: Date.now(),
        error: error.message || String(error),
      }));
    }
  }, [currentVersion]);

  const openUpdatePage = useCallback(async () => {
    if (!updateState.updateUrl) return;
    await tabsCreate(updateState.updateUrl);
  }, [updateState.updateUrl]);

  return {
    currentVersion,
    updateState,
    setUpdateState,
    loadUpdateState,
    runExtensionUpdateCheck,
    openUpdatePage,
  };
}
