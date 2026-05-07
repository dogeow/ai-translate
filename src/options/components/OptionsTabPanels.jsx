import { HomeTab } from "./HomeTab.jsx";
import { PickModeTab } from "./PickModeTab.jsx";
import { PageTranslateTab } from "./PageTranslateTab.jsx";
import { TranslateTestTab } from "./TranslateTestTab.jsx";
import { ShortcutsTab } from "./ShortcutsTab.jsx";
import { TranslationCacheTab } from "./TranslationCacheTab.jsx";
import { AiLogsTab } from "./AiLogsTab.jsx";
import { LearningTab } from "./LearningTab.jsx";
import { UiRewriteTab } from "./UiRewriteTab.jsx";
import { WordLearningTab } from "./WordLearningTab.jsx";
import { AboutTab } from "./AboutTab.jsx";
import {
  OPTIONS_TAB_ORDER,
  getOptionsTabButtonId,
  getOptionsTabPanelId,
} from "./optionsNavigation.js";

function OptionsTabPanel({ activeTab, tabId, children }) {
  return (
    <div
      className="options-tabs__panel"
      id={getOptionsTabPanelId(tabId)}
      role="tabpanel"
      aria-labelledby={getOptionsTabButtonId(tabId)}
      hidden={activeTab !== tabId}
    >
      {children}
    </div>
  );
}

function getMissingPanelContent(tabId) {
  return (
    <div className="card">
      <p>未找到 {tabId} 对应的设置面板。</p>
    </div>
  );
}

export function OptionsTabPanels({
  activeTab,
  settingsController,
  connectionState,
  translateTestState,
  shortcuts,
  updateInfo,
}) {
  const {
    settings,
    settingsRef,
    updateSettings,
    persistSettings,
    showAutoSaveStatus,
  } = settingsController;
  const {
    models,
    modelDropdownOpen,
    setModelDropdownOpen,
    setOriginsModalOpen,
    testConnectionResult,
    updateConnectionStatus,
  } = connectionState;
  const {
    currentVersion,
    updateState,
    runExtensionUpdateCheck,
    openUpdatePage,
  } = updateInfo;

  const panelContentById = {
    home: (
      <HomeTab
        settings={settings}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
        models={models}
        modelDropdownOpen={modelDropdownOpen}
        setModelDropdownOpen={setModelDropdownOpen}
        setOriginsModalOpen={setOriginsModalOpen}
        testConnectionResult={testConnectionResult}
        updateConnectionStatus={updateConnectionStatus}
      />
    ),
    translate: (
      <TranslateTestTab {...translateTestState} provider={settings.provider} />
    ),
    "pick-mode": (
      <PickModeTab
        settings={settings}
        settingsRef={settingsRef}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    ),
    "page-translate": (
      <PageTranslateTab
        settings={settings}
        settingsRef={settingsRef}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    ),
    shortcuts: <ShortcutsTab shortcuts={shortcuts} />,
    "translation-cache": <TranslationCacheTab />,
    logs: <AiLogsTab />,
    learning: (
      <LearningTab
        settings={settings}
        updateSettings={updateSettings}
      />
    ),
    "ui-rewrite": <UiRewriteTab />,
    "word-learning": <WordLearningTab />,
    about: (
      <AboutTab
        currentVersion={currentVersion}
        updateState={updateState}
        runExtensionUpdateCheck={runExtensionUpdateCheck}
        openUpdatePage={openUpdatePage}
      />
    ),
  };

  return (
    <div className="options-tabs">
      {OPTIONS_TAB_ORDER.map((tabId) => (
        <OptionsTabPanel key={tabId} activeTab={activeTab} tabId={tabId}>
          {panelContentById[tabId] || getMissingPanelContent(tabId)}
        </OptionsTabPanel>
      ))}
    </div>
  );
}