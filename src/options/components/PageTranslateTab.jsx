import { SettingNumberInput } from "./common/NumberInput.jsx";
import {
  normalizePageTranslateBatchChars,
  normalizePageTranslateConcurrency,
} from "../../shared/settings.js";

export function PageTranslateTab({
  settings,
  settingsRef,
  updateSettings,
  persistSettings,
  showAutoSaveStatus,
}) {
  return (
    <div className="card">
      <h2>页面翻译</h2>
      <p className="shortcuts-desc">
        调整页面翻译的并发与批量参数。数值越大，请求更少但单次响应可能更慢。
      </p>

      <SettingNumberInput
        id="pageTranslateConcurrency"
        label="页面翻译并发"
        settingKey="pageTranslateConcurrency"
        value={settings.pageTranslateConcurrency}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
        normalizer={normalizePageTranslateConcurrency}
        suffix="请求"
        min={1}
        max={8}
        step={1}
        hint="同时发送的页面翻译请求数，默认 2。"
      />

      <SettingNumberInput
        id="pageTranslateBatchChars"
        label="页面翻译批量字符数"
        settingKey="pageTranslateBatchChars"
        value={settings.pageTranslateBatchChars}
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
        normalizer={normalizePageTranslateBatchChars}
        suffix="字符"
        min={32}
        max={2048}
        step={32}
        hint="每批累计文字达到该长度后不再加条，避免短句过多时提示词比正文还长。默认 128，可自行调整。"
      />
    </div>
  );
}
