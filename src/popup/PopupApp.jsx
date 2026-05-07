import { useEffect, useState } from "react";
import {
  createDefaultUpdateState,
  UPDATE_STATE_KEY,
} from "../shared/update.js";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
} from "../shared/constants.js";
import {
  AutoTranslateModePanel,
  HoverTranslateScopePanel,
  PopupHero,
  QuickActionsPanel,
  UpdateBanner,
  UiRewriteAndLearningPanel,
} from "./components/index.js";
import {
  usePopupSettings,
  usePageTranslate,
} from "./hooks/usePopupSettings.js";

// 为 popup 创建简洁版选项（使用 shortTitle）
const AUTO_MODE_OPTIONS = AUTO_TRANSLATE_MODE_OPTIONS.map((option) => ({
  value: option.value,
  title: option.shortTitle,
}));

const HOVER_SCOPE_OPTIONS = HOVER_TRANSLATE_SCOPE_OPTIONS.map((option) => ({
  value: option.value,
  title: option.title,
}));

export function PopupApp() {
  const currentVersion = chrome.runtime.getManifest().version;
  const [updateState, setUpdateState] = useState(
    createDefaultUpdateState(currentVersion),
  );

  // 使用自定义 hooks 管理状态
  const popupSettings = usePopupSettings();
  const pageTranslate = usePageTranslate(popupSettings.appEnabled);

  // 加载更新状态
  useEffect(() => {
    chrome.storage.local.get(UPDATE_STATE_KEY, (value) => {
      setUpdateState({
        ...createDefaultUpdateState(currentVersion),
        ...(value[UPDATE_STATE_KEY] || {}),
      });
    });
  }, [currentVersion]);

  function openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options/index.html"),
    });
    window.close();
  }

  function openUpdatePage() {
    if (!updateState.updateUrl) return;
    chrome.tabs.create({
      url: updateState.updateUrl,
    });
    window.close();
  }

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
    <div className="popup">
      <PopupHero
        appEnabled={popupSettings.appEnabled}
        onToggleApp={popupSettings.toggleAppEnabled}
        onOpenSettings={openOptionsPage}
      />
      {updateState.status === "available" && (
        <UpdateBanner
          latestVersion={updateState.latestVersion}
          currentVersion={currentVersion}
          onOpenUpdate={openUpdatePage}
        />
      )}
      <QuickActionsPanel
        appEnabled={popupSettings.appEnabled}
        isStartingPageTranslate={pageTranslate.isStarting}
        pageTranslateStatus={pageTranslate.status}
        onStartPageTranslate={pageTranslate.startPageTranslate}
        onToggleSiteAutoTranslate={pageTranslate.toggleSiteAutoTranslate}
        siteAutoTranslateEnabled={pageTranslate.siteAutoTranslateEnabled}
        activeOrigin={pageTranslate.activeOrigin}
        provider={popupSettings.provider}
        onProviderChange={popupSettings.updateProvider}
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
        />
      )}
      <UiRewriteAndLearningPanel />
      <p className="popup-version">当前版本 {currentVersion}</p>
    </div>
  );
}
