import { useEffect, useState } from "react";
import { ConnectionStatusBanner } from "./components/ConnectionStatusBanner.jsx";
import { OriginsModal } from "./components/OriginsModal.jsx";
import { TranslateResultView } from "./components/TranslateResultView.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { HomeTab } from "./components/HomeTab.jsx";
import { PickModeTab } from "./components/PickModeTab.jsx";
import { PageTranslateTab } from "./components/PageTranslateTab.jsx";
import { TranslateTestTab } from "./components/TranslateTestTab.jsx";
import { ShortcutsTab } from "./components/ShortcutsTab.jsx";
import { AiLogsTab } from "./components/AiLogsTab.jsx";
import { LearningTab } from "./components/LearningTab.jsx";
import { AboutTab } from "./components/AboutTab.jsx";
import { useSettings } from "./hooks/useSettings.js";
import { useConnectionStatus } from "./hooks/useConnectionStatus.js";
import { useUpdateCheck } from "./hooks/useUpdateCheck.js";
import { useTranslateTest } from "./hooks/useTranslateTest.js";
import { TRANSLATE_RESULT_KEY } from "../shared/constants.js";
import { commandsGetAll, storageLocalGet } from "./lib/chrome.js";
import { detectPlatform, getConfig } from "./lib/utils.js";

export function OptionsApp() {
  const [view, setView] = useState(
    window.location.hash === "#translate" ? "translate-result" : "options",
  );
  const [activeTab, setActiveTab] = useState("home");
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
  } = useConnectionStatus({ settingsRef, updateSettings, persistSettings });

  const translateTest = useTranslateTest({
    settingsRef,
    setConnectionStatus,
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [nextSettings, storedTranslateResult, commandList] =
          await Promise.all([
            loadSettings(),
            storageLocalGet(TRANSLATE_RESULT_KEY),
            commandsGetAll(),
          ]);
        if (cancelled) return;

        translateTest.setTestTargetLang(nextSettings.translateTargetLang);
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
          <div className="options-tabs">
            <div
              className="options-tabs__tablist"
              role="tablist"
              aria-label="设置"
            ></div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "home"}
              key="home"
            >
              <HomeTab
                settings={settings}
                updateSettings={updateSettings}
                persistSettings={persistSettings}
                settingsRef={settingsRef}
                showAutoSaveStatus={showAutoSaveStatus}
                connectionStatus={connectionStatus}
                models={models}
                modelDropdownOpen={modelDropdownOpen}
                setModelDropdownOpen={setModelDropdownOpen}
                setOriginsModalOpen={setOriginsModalOpen}
                testConnectionResult={testConnectionResult}
                updateConnectionStatus={updateConnectionStatus}
              />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "translate"}
              key="translate"
            >
              <TranslateTestTab
                testInput={translateTest.testInput}
                setTestInput={translateTest.setTestInput}
                testSourceLang={translateTest.testSourceLang}
                setTestSourceLang={translateTest.setTestSourceLang}
                testTargetLang={translateTest.testTargetLang}
                setTestTargetLang={translateTest.setTestTargetLang}
                testModelOverride={translateTest.testModelOverride}
                setTestModelOverride={translateTest.setTestModelOverride}
                models={models}
                defaultModel={getConfig(settings).model}
                detectLangResult={translateTest.detectLangResult}
                testTranslateHint={translateTest.testTranslateHint}
                testTranslateResult={translateTest.testTranslateResult}
                runDetectLanguage={translateTest.runDetectLanguage}
                runTranslateTest={translateTest.runTranslateTest}
              />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "pick-mode"}
              key="pick-mode"
            >
              <PickModeTab
                settings={settings}
                settingsRef={settingsRef}
                updateSettings={updateSettings}
                persistSettings={persistSettings}
                showAutoSaveStatus={showAutoSaveStatus}
              />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "page-translate"}
              key="page-translate"
            >
              <PageTranslateTab
                settings={settings}
                settingsRef={settingsRef}
                updateSettings={updateSettings}
                persistSettings={persistSettings}
                showAutoSaveStatus={showAutoSaveStatus}
              />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "shortcuts"}
              key="shortcuts"
            >
              <ShortcutsTab shortcuts={shortcuts} />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "logs"}
              key="logs"
            >
              <AiLogsTab />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "learning"}
              key="learning"
            >
              <LearningTab
                settings={settings}
                updateSettings={updateSettings}
              />
            </div>

            <div
              className="options-tabs__panel"
              hidden={activeTab !== "about"}
              key="about"
            >
              <AboutTab
                currentVersion={currentVersion}
                updateState={updateState}
                runExtensionUpdateCheck={runExtensionUpdateCheck}
                openUpdatePage={openUpdatePage}
              />
            </div>
          </div>
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
