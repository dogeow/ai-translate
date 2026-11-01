import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_MODIFIER_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
  WORD_LOOKUP_PROVIDER_YOUDAO,
} from "../shared/constants.js";
import {
  AiRewritePanel,
  AutoTranslateModePanel,
  EnglishLearningPanel,
  HoverTranslateScopePanel,
  PopupHero,
  QuickActionsPanel,
} from "./components/index.js";
import {
  usePopupSettings,
  usePageTranslate,
} from "./hooks/usePopupSettings.js";
import { getVerifiedModelOptions } from "./lib/providerAvailability.js";
import { openEnglishExamplePage } from "./lib/examplePage.js";
import { getSidePanelSupport, openSidePanel } from "./lib/sidePanel.js";
import { useArticleNarration } from "./hooks/useArticleNarration.js";

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

const POPUP_TABS = [
  { id: "translate", label: "翻译" },
  { id: "learn", label: "英语学习" },
  { id: "rewrite", label: "页面改造" },
];
const ACTIVE_PANEL_STORAGE_KEY = "ai-translate:popup-active-panel";

function readStoredPanel() {
  try {
    const stored = localStorage.getItem(ACTIVE_PANEL_STORAGE_KEY);
    if (POPUP_TABS.some((tab) => tab.id === stored)) return stored;
  } catch (_) {}
  return "translate";
}

// 复用已打开的设置页，避免每次点击都新开标签
function openExtensionPage(path) {
  const url = chrome.runtime.getURL(path);
  const baseUrl = chrome.runtime.getURL(path.split("?")[0]);
  return new Promise((resolve) => {
    chrome.tabs.query({ url: `${baseUrl}*` }, (tabs) => {
      const existing = !chrome.runtime.lastError && tabs?.[0];
      if (!existing?.id) {
        chrome.tabs.create({ url }, () => resolve());
        return;
      }
      chrome.tabs.update(
        existing.id,
        { active: true, ...(url !== existing.url ? { url } : {}) },
        () => {
          if (existing.windowId != null) {
            chrome.windows.update(existing.windowId, { focused: true }, () =>
              resolve(),
            );
          } else {
            resolve();
          }
        },
      );
    });
  });
}

export function PopupApp({ surface = "popup" }) {
  const [activePanel, setActivePanel] = useState(readStoredPanel);
  const currentVersion = chrome.runtime.getManifest().version;
  const isPopup = surface === "popup";
  const sidePanelSupport = getSidePanelSupport();
  const [currentWindowId, setCurrentWindowId] = useState(null);

  // 使用自定义 hooks 管理状态
  const popupSettings = usePopupSettings();
  const pageTranslate = usePageTranslate(popupSettings.appEnabled);
  const articleNarration = useArticleNarration(popupSettings.appEnabled);
  const { settings, chromeAiReady } = popupSettings;
  // 记忆化：下方的回退 effect 依赖这些数组，避免每次渲染都重新触发
  const availableModels = useMemo(
    () => getVerifiedModelOptions(settings, { chromeAiReady }),
    [settings, chromeAiReady],
  );
  const availableGenerativeModels = useMemo(
    () =>
      getVerifiedModelOptions(settings, {
        chromeAiReady,
        includeChromeAi: false,
        shortenChatGptLabel: true,
      }),
    [settings, chromeAiReady],
  );
  const availableWordModels = useMemo(
    () =>
      getVerifiedModelOptions(settings, {
        chromeAiReady,
        shortenChatGptLabel: true,
      }),
    [settings, chromeAiReady],
  );
  const wordLookupOptions = useMemo(
    () => [
      {
        value: WORD_LOOKUP_PROVIDER_YOUDAO,
        label: "有道词典（默认，失败时使用学习模型）",
      },
      ...availableWordModels,
    ],
    [availableWordModels],
  );

  const selectPanel = useCallback((panelId) => {
    setActivePanel(panelId);
    try {
      localStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, panelId);
    } catch (_) {}
  }, []);

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
      availableModels.some((option) => option.value === popupSettings.provider)
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

  useEffect(() => {
    if (
      !popupSettings.isSettingsLoaded ||
      popupSettings.wordLookupProvider === WORD_LOOKUP_PROVIDER_YOUDAO ||
      availableWordModels.some(
        (option) => option.value === popupSettings.wordLookupProvider,
      )
    ) {
      return;
    }
    popupSettings.updateWordLookupProvider(WORD_LOOKUP_PROVIDER_YOUDAO);
  }, [
    availableWordModels,
    popupSettings.isSettingsLoaded,
    popupSettings.updateWordLookupProvider,
    popupSettings.wordLookupProvider,
  ]);

  function openOptionsPage() {
    void openExtensionPage("options/index.html").then(() => {
      if (isPopup) window.close();
    });
  }

  function openProviderSetup() {
    void openExtensionPage("options/index.html?add-provider=1").then(() => {
      if (isPopup) window.close();
    });
  }

  function openEnglishExample() {
    const opened = openEnglishExamplePage();
    if (opened && isPopup) window.close();
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
  const learningModeSupported = availableGenerativeModels.some(
    (option) => option.value === popupSettings.learningProvider,
  );

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
        appEnabled={popupSettings.appEnabled}
        onToggleApp={popupSettings.toggleAppEnabled}
        onOpenSettings={openOptionsPage}
      />
      <div className="popup-tabs" role="tablist" aria-label="功能分组">
        {POPUP_TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`popup-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activePanel === tab.id}
            aria-controls={`popup-panel-${tab.id}`}
            tabIndex={activePanel === tab.id ? 0 : -1}
            onClick={() => selectPanel(tab.id)}
            onKeyDown={(event) => {
              let next;
              if (event.key === "ArrowRight")
                next = (index + 1) % POPUP_TABS.length;
              if (event.key === "ArrowLeft")
                next = (index - 1 + POPUP_TABS.length) % POPUP_TABS.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = POPUP_TABS.length - 1;
              if (next === undefined) return;
              event.preventDefault();
              selectPanel(POPUP_TABS[next].id);
              document.getElementById(`popup-tab-${POPUP_TABS[next].id}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {!popupSettings.appEnabled && (
        <p className="popup-paused-note" role="status">
          翻译已暂停，点击右上方开关恢复。
        </p>
      )}
      <div
        className="popup-tab-content"
        id="popup-panel-translate"
        role="tabpanel"
        aria-labelledby="popup-tab-translate"
        hidden={activePanel !== "translate"}
      >
        <QuickActionsPanel
          appEnabled={popupSettings.appEnabled}
          isTogglingPageTranslate={pageTranslate.isToggling}
          isChangingPageDisplayMode={pageTranslate.isChangingDisplayMode}
          isTogglingSiteAutoTranslate={pageTranslate.isTogglingSiteAutoTranslate}
          isPageTranslateActive={pageTranslate.isPageTranslateActive}
          pageDisplayMode={pageTranslate.displayMode}
          pageTranslateStatus={pageTranslate.status}
          articleNarrationState={articleNarration.state}
          isChangingArticleNarration={articleNarration.isChanging}
          articleNarrationStatus={articleNarration.statusMessage}
          onToggleArticleNarration={articleNarration.toggle}
          onStopArticleNarration={articleNarration.stop}
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
      </div>
      <div
        className="popup-tab-content"
        id="popup-panel-learn"
        role="tabpanel"
        aria-labelledby="popup-tab-learn"
        hidden={activePanel !== "learn"}
      >
        <EnglishLearningPanel
          learningModeEnabled={
            learningModeSupported && popupSettings.learningModeEnabled
          }
          learningModeSupported={learningModeSupported}
          onToggleLearningMode={popupSettings.toggleLearningModeEnabled}
          provider={popupSettings.learningProvider}
          onProviderChange={popupSettings.updateLearningProvider}
          availableModels={availableGenerativeModels}
          wordLookupProvider={popupSettings.wordLookupProvider}
          onWordLookupProviderChange={popupSettings.updateWordLookupProvider}
          wordLookupOptions={wordLookupOptions}
          modelsLoading={!popupSettings.isSettingsLoaded}
          onOpenProviderSetup={openProviderSetup}
        />
      </div>
      <div
        className="popup-tab-content"
        id="popup-panel-rewrite"
        role="tabpanel"
        aria-labelledby="popup-tab-rewrite"
        hidden={activePanel !== "rewrite"}
      >
        <AiRewritePanel
          provider={popupSettings.uiRewriteProvider}
          onProviderChange={popupSettings.updateUiRewriteProvider}
          availableModels={availableGenerativeModels}
          modelsLoading={!popupSettings.isSettingsLoaded}
          onOpenProviderSetup={openProviderSetup}
        />
      </div>
      <footer className="popup-footer">
        <div className="popup-footer__links">
          <button
            type="button"
            onClick={openEnglishExample}
            title="打开英语新闻示例页面"
          >
            英语示例 ↗
          </button>
          {showSidePanelButton && (
            <button
              type="button"
              onClick={openPersistentSidePanel}
              disabled={sidePanelButtonDisabled}
            >
              打开侧栏 ↗
            </button>
          )}
        </div>
        <span
          className={`popup-footer__status popup-footer__status--${saveStatusTone}`}
          role="status"
        >
          {showSaveStatus ? saveStatusText : `v${currentVersion}`}
        </span>
      </footer>
    </div>
  );
}
