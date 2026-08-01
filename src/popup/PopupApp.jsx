import { useEffect, useState } from "react";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_MODIFIER_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
} from "../shared/constants.js";
import {
  AutoTranslateModePanel,
  HoverTranslateScopePanel,
  PopupHero,
  QuickActionsPanel,
  UiRewriteAndLearningPanel,
} from "./components/index.js";
import {
  usePopupSettings,
  usePageTranslate,
} from "./hooks/usePopupSettings.js";
import { getVerifiedModelOptions } from "./lib/providerAvailability.js";
import { getSidePanelSupport, openSidePanel } from "./lib/sidePanel.js";

// 为 popup 创建简洁版选项（使用 shortTitle）
const AUTO_MODE_OPTIONS = AUTO_TRANSLATE_MODE_OPTIONS.map((option) => ({
  value: option.value,
  title: option.shortTitle,
}));

const HOVER_SCOPE_OPTIONS = HOVER_TRANSLATE_SCOPE_OPTIONS.map((option) => ({
  value: option.value,
  title: option.title,
}));

const HOVER_MODIFIER_OPTIONS = HOVER_TRANSLATE_MODIFIER_OPTIONS.map(
  (option) => ({
    value: option.value,
    label: option.label,
  }),
);

export function PopupApp({ surface = "popup" }) {
  const currentVersion = chrome.runtime.getManifest().version;
  const isPopup = surface === "popup";
  const sidePanelSupport = getSidePanelSupport();
  const [currentWindowId, setCurrentWindowId] = useState(null);

  // 使用自定义 hooks 管理状态
  const popupSettings = usePopupSettings();
  const pageTranslate = usePageTranslate(popupSettings.appEnabled);
  const availableModels = getVerifiedModelOptions(
    popupSettings.settings,
    { chromeAiReady: popupSettings.chromeAiReady },
  );
  const availableGenerativeModels = getVerifiedModelOptions(
    popupSettings.settings,
    {
      chromeAiReady: popupSettings.chromeAiReady,
      includeChromeAi: false,
    },
  );

  useEffect(() => {
    if (!isPopup || !sidePanelSupport.chrome) return;
    chrome.windows.getCurrent((currentWindow) => {
      if (chrome.runtime.lastError) return;
      setCurrentWindowId(currentWindow?.id ?? null);
    });
  }, [isPopup, sidePanelSupport.chrome]);

  useEffect(() => {
    if (
      !popupSettings.isSettingsLoaded ||
      availableModels.length === 0 ||
      availableModels.some(
        (option) => option.value === popupSettings.provider,
      )
    ) {
      return;
    }
    popupSettings.updateProvider(availableModels[0].value);
  }, [
    availableModels,
    popupSettings.isSettingsLoaded,
    popupSettings.provider,
    popupSettings.updateProvider,
  ]);

  useEffect(() => {
    if (
      !popupSettings.isSettingsLoaded ||
      availableGenerativeModels.length === 0
    ) {
      return;
    }
    const fallbackProvider = availableGenerativeModels[0].value;
    if (
      !availableGenerativeModels.some(
        (option) => option.value === popupSettings.uiRewriteProvider,
      )
    ) {
      popupSettings.updateUiRewriteProvider(fallbackProvider);
    }
    if (
      !availableGenerativeModels.some(
        (option) => option.value === popupSettings.learningProvider,
      )
    ) {
      popupSettings.updateLearningProvider(fallbackProvider);
    }
  }, [
    availableGenerativeModels,
    popupSettings.isSettingsLoaded,
    popupSettings.learningProvider,
    popupSettings.uiRewriteProvider,
    popupSettings.updateLearningProvider,
    popupSettings.updateUiRewriteProvider,
  ]);

  function openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options/index.html"),
    });
    if (isPopup) window.close();
  }

  function openProviderSetup() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options/index.html?add-provider=1"),
    });
    if (isPopup) window.close();
  }

  function openPersistentSidePanel() {
    void openSidePanel({ windowId: currentWindowId })
      .then(() => window.close())
      .catch((error) => {
        console.error("Open side panel failed:", error);
      });
  }

  const showSidePanelButton =
    isPopup && (sidePanelSupport.chrome || sidePanelSupport.firefox);
  const sidePanelButtonDisabled =
    sidePanelSupport.chrome && currentWindowId === null;

  const showSaveStatus =
    popupSettings.isSaving || Boolean(popupSettings.saveStatusText);
  const saveStatusText = popupSettings.isSaving
    ? "保存中..."
    : popupSettings.saveStatusText;
  const saveStatusTone = popupSettings.isSaving
    ? "neutral"
    : popupSettings.saveStatusIsError
      ? "error"
      : "success";

  return (
    <div className={`popup popup--${surface}`}>
      <PopupHero
        surface={surface}
        appEnabled={popupSettings.appEnabled}
        onToggleApp={popupSettings.toggleAppEnabled}
        onOpenSettings={openOptionsPage}
        showSidePanelButton={showSidePanelButton}
        sidePanelButtonDisabled={sidePanelButtonDisabled}
        onOpenSidePanel={openPersistentSidePanel}
      />
      <QuickActionsPanel
        appEnabled={popupSettings.appEnabled}
        isTogglingPageTranslate={pageTranslate.isToggling}
        isChangingPageDisplayMode={pageTranslate.isChangingDisplayMode}
        isPageTranslateActive={pageTranslate.isPageTranslateActive}
        pageDisplayMode={pageTranslate.displayMode}
        pageTranslateStatus={pageTranslate.status}
        onTogglePageTranslate={pageTranslate.togglePageTranslate}
        onPageDisplayModeChange={pageTranslate.changeDisplayMode}
        onToggleSiteAutoTranslate={pageTranslate.toggleSiteAutoTranslate}
        siteAutoTranslateEnabled={pageTranslate.siteAutoTranslateEnabled}
        activeOrigin={pageTranslate.activeOrigin}
        provider={popupSettings.provider}
        onProviderChange={popupSettings.updateProvider}
        availableProviders={availableModels}
        providersLoading={!popupSettings.isSettingsLoaded}
        onOpenProviderSetup={openProviderSetup}
        showStatus={showSaveStatus}
        statusText={saveStatusText}
        statusTone={saveStatusTone}
      />
      <AutoTranslateModePanel
        options={AUTO_MODE_OPTIONS}
        value={popupSettings.autoTranslateMode}
        onChange={popupSettings.updateAutoTranslateMode}
      />
      {popupSettings.autoTranslateMode === "hover" && (
        <HoverTranslateScopePanel
          options={HOVER_SCOPE_OPTIONS}
          value={popupSettings.hoverTranslateScope}
          onChange={popupSettings.updateHoverTranslateScope}
          modifierOptions={HOVER_MODIFIER_OPTIONS}
          modifierValue={popupSettings.hoverTranslateModifierKey}
          onModifierChange={popupSettings.updateHoverTranslateModifierKey}
        />
      )}
      <UiRewriteAndLearningPanel
        uiRewriteProvider={popupSettings.uiRewriteProvider}
        learningProvider={popupSettings.learningProvider}
        onUiRewriteProviderChange={popupSettings.updateUiRewriteProvider}
        onLearningProviderChange={popupSettings.updateLearningProvider}
        availableModels={availableGenerativeModels}
        modelsLoading={!popupSettings.isSettingsLoaded}
        onOpenProviderSetup={openProviderSetup}
      />
      <p className="popup-version">当前版本 {currentVersion}</p>
    </div>
  );
}
