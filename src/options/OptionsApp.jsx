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
import { useUpdateCheck } from "./hooks/useUpdateCheck.js";
import { useTranslateTest } from "./hooks/useTranslateTest.js";
import { detectPlatform, getConfig } from "./lib/utils.js";

export function OptionsApp() {
  const [view, setView] = useState(
    window.location.hash === "#translate" ? "translate-result" : "options",
  );
  const [activeTab, setActiveTab] = useState(OPTIONS_DEFAULT_TAB);
  const [translateResult, setTranslateResult] = useState({});
  const [originsPlatform, setOriginsPlatform] = useState(detectPlatform());
  const [shortcuts, setShortcuts] = useState([]);

  const {
    settings,
    settingsRef,
    autoSaveStatus,
    showAutoSaveStatus,
    persistSettings,
    updateSettings,
    loadSettings,
  } = useSettings();

  const {
    currentVersion,
    updateState,
    loadUpdateState,
    runExtensionUpdateCheck,
    openUpdatePage,
  } = useUpdateCheck();

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
    loadUpdateState,
    updateConnectionStatus,
    setTestTargetLang: translateTest.setTestTargetLang,
    setTranslateResult,
    setShortcuts,
  });

  const settingsController = {
    settings,
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
  const updateInfo = {
    currentVersion,
    updateState,
    runExtensionUpdateCheck,
    openUpdatePage,
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
          <h1>Ollama 翻译设置</h1>
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
            updateInfo={updateInfo}
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
