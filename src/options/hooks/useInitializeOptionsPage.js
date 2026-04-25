import { useEffect, useRef } from "react";
import { TRANSLATE_RESULT_KEY } from "../../shared/constants.js";
import { commandsGetAll, storageLocalGet } from "../lib/chrome.js";

export function useInitializeOptionsPage({
  loadSettings,
  loadUpdateState,
  updateConnectionStatus,
  setTestTargetLang,
  setTranslateResult,
  setShortcuts,
}) {
  const initActionsRef = useRef({
    loadSettings,
    loadUpdateState,
    updateConnectionStatus,
    setTestTargetLang,
    setTranslateResult,
    setShortcuts,
  });

  initActionsRef.current = {
    loadSettings,
    loadUpdateState,
    updateConnectionStatus,
    setTestTargetLang,
    setTranslateResult,
    setShortcuts,
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const {
          loadSettings,
          loadUpdateState,
          updateConnectionStatus,
          setTestTargetLang,
          setTranslateResult,
          setShortcuts,
        } = initActionsRef.current;
        const [nextSettings, storedTranslateResult, commandList] =
          await Promise.all([
            loadSettings(),
            storageLocalGet(TRANSLATE_RESULT_KEY),
            commandsGetAll(),
          ]);
        if (cancelled) return;

        setTestTargetLang(nextSettings.translateTargetLang);
        setTranslateResult(storedTranslateResult || {});
        setShortcuts(commandList);

        await loadUpdateState();
        if (cancelled) return;

        await updateConnectionStatus(nextSettings);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to initialize options page:", error);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);
}