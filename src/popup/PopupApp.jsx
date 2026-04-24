import { useEffect, useState } from "react";
import {
  createDefaultUpdateState,
  UPDATE_STATE_KEY,
} from "../shared/update.js";
import { TRANSLATE_PROVIDER_OPTIONS } from "../options/lib/constants.js";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
} from "../shared/constants.js";
import {
  AppToggle,
  UpdateBanner,
  Panel,
  ChoiceGrid,
} from "./components/PopupComponents.jsx";
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

  return (
    <div className="popup">
      <header className="popup-hero">
        <div className="popup-hero__title-group">
          <h1>Ollama 翻译</h1>
          <AppToggle
            enabled={popupSettings.appEnabled}
            onToggle={popupSettings.toggleAppEnabled}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-inline popup-settings-btn"
          onClick={openOptionsPage}
        >
          设置
        </button>
      </header>
      {updateState.status === "available" && (
        <UpdateBanner
          latestVersion={updateState.latestVersion}
          currentVersion={currentVersion}
          onOpenUpdate={openUpdatePage}
        />
      )}
      <Panel title="快速操作" isSubtle>
        <button
          type="button"
          className="btn btn-primary popup-page-translate-btn"
          onClick={pageTranslate.startPageTranslate}
          disabled={!popupSettings.appEnabled || pageTranslate.isStarting}
        >
          {pageTranslate.isStarting ? "启动中..." : "开始页面翻译"}
        </button>
        {pageTranslate.status && (
          <div className="popup-page-translate-status" role="status">
            {pageTranslate.status}
          </div>
        )}
        <div className="popup-field">
          <label className="popup-field__label" htmlFor="popup-provider-select">
            API 厂家
          </label>
          <select
            id="popup-provider-select"
            className="popup-provider-select"
            value={popupSettings.provider}
            onChange={(e) => popupSettings.updateProvider(e.target.value)}
          >
            {TRANSLATE_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Panel>
      <Panel title="自动翻译模式" className="popup-panel--mode">
        <ChoiceGrid
          options={AUTO_MODE_OPTIONS}
          value={popupSettings.autoTranslateMode}
          onChange={popupSettings.updateAutoTranslateMode}
        />
      </Panel>
      {popupSettings.autoTranslateMode === "hover" && (
        <Panel title="悬停翻译范围" isSubtle>
          <ChoiceGrid
            options={HOVER_SCOPE_OPTIONS}
            value={popupSettings.hoverTranslateScope}
            onChange={popupSettings.updateHoverTranslateScope}
            isCompact
          />
        </Panel>
      )}
      <p className="popup-version">当前版本 {currentVersion}</p>
    </div>
  );
}
