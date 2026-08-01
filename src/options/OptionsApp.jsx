import { useState } from "react";
import { ConnectionStatusBanner } from "./components/ConnectionStatusBanner.jsx";
import { OriginsModal } from "./components/OriginsModal.jsx";
import { OptionsTabPanels } from "./components/OptionsTabPanels.jsx";
import { TranslateResultView } from "./components/TranslateResultView.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { OPTIONS_DEFAULT_TAB } from "./components/optionsNavigation.js";
import { useSettings } from "./hooks/useSettings.js";
import { useInitializeOptionsPage } from "./hooks/useInitializeOptionsPage.js";
import { useConnectionStatus } from "./hooks/useConnectionStatus.js";
import { useTranslateTest } from "./hooks/useTranslateTest.js";
import { detectPlatform, getConfig } from "./lib/utils.js";

export function OptionsApp() {
  const currentVersion = chrome.runtime.getManifest().version;
  const [view, setView] = useState(
    window.location.hash === "#translate" ? "translate-result" : "options",
  );
  const [activeTab, setActiveTab] = useState(OPTIONS_DEFAULT_TAB);
  const [translateResult, setTranslateResult] = useState({});
  const [originsPlatform, setOriginsPlatform] = useState(detectPlatform());
  const [shortcuts, setShortcuts] = useState([]);

  const {
    settings,
    isSettingsLoaded,
    settingsRef,
    autoSaveStatus,
    showAutoSaveStatus,
    persistSettings,
    updateSettings,
    loadSettings,
  } = useSettings();

  const {
    connectionStatus,
    setConnectionStatus,
    models,
    modelDropdownOpen,
    setModelDropdownOpen,
    originsModalOpen,
    setOriginsModalOpen,
    testConnectionResult,
    updateConnectionStatus,
  } = useConnectionStatus();

  const translateTest = useTranslateTest({
    settingsRef,
    setConnectionStatus,
  });

  useInitializeOptionsPage({
    loadSettings,
    updateConnectionStatus,
    setTestTargetLang: translateTest.setTestTargetLang,
    setTranslateResult,
    setShortcuts,
  });

  const settingsController = {
    settings,
    isSettingsLoaded,
    settingsRef,
    updateSettings,
    persistSettings,
    showAutoSaveStatus,
  };
  const connectionState = {
    models,
    modelDropdownOpen,
    setModelDropdownOpen,
    setOriginsModalOpen,
    testConnectionResult,
    updateConnectionStatus,
  };
  const translateTestState = {
    ...translateTest,
    models,
    defaultModel: getConfig(settings).model,
  };
  function openOptionsView() {
    history.replaceState(null, "", window.location.pathname);
    setView("options");
  }

  if (view === "translate-result") {
    return (
      <TranslateResultView result={translateResult} onBack={openOptionsView} />
    );
  }

  return (
    <>
      <OriginsModal
        isOpen={originsModalOpen}
        activePlatform={originsPlatform}
        onChangePlatform={setOriginsPlatform}
        onClose={() => setOriginsModalOpen(false)}
      />
      <div className="options">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentVersion={currentVersion}
        />

        <main className="options-content">
          <h1>英语学习和AI翻译设置</h1>
          <ConnectionStatusBanner
            status={connectionStatus}
            onOpenOrigins={() => setOriginsModalOpen(true)}
          />
          <OptionsTabPanels
            activeTab={activeTab}
            settingsController={settingsController}
            connectionState={connectionState}
            translateTestState={translateTestState}
            shortcuts={shortcuts}
            currentVersion={currentVersion}
          />
        </main>
        <p
          className={`status ${autoSaveStatus.isError ? "status--error" : ""}`.trim()}
        >
          {autoSaveStatus.text}
        </p>
      </div>
    </>
  );
}
