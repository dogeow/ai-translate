import { RadioGroup, SelectField } from "./common/FormField.jsx";
import { SettingNumberInput } from "./common/NumberInput.jsx";
import { normalizeHoverTranslateDelayMs } from "../../shared/settings.js";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_MODIFIER_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
} from "../../shared/constants.js";

export function PickModeTab({
  settings,
  settingsRef,
  updateSettings,
  persistSettings,
  showAutoSaveStatus,
}) {
  return (
    <div className="card">
      <h2>取词方式</h2>
      <p className="shortcuts-desc">
        选择你想用的取词/触发方式：热键、双击/三击、或悬停自动翻译。
      </p>

      <RadioGroup
        name="autoTranslateMode"
        label="自动翻译模式"
        value={settings.autoTranslateMode}
        onChange={(value) => updateSettings({ autoTranslateMode: value }, "now")}
        options={AUTO_TRANSLATE_MODE_OPTIONS}
      />

      {settings.autoTranslateMode === "hover" ? (
        <>
          <SelectField
            id="hoverTranslateScope"
            label="悬停翻译范围"
            value={settings.hoverTranslateScope}
            onChange={(event) =>
              updateSettings({ hoverTranslateScope: event.target.value }, "now")
            }
            options={HOVER_TRANSLATE_SCOPE_OPTIONS}
          />
          <span className="hint">
            这是未按临时切换键时使用的默认范围。
          </span>

          <SelectField
            id="hoverTranslateModifierKey"
            label="悬停临时切换键"
            value={settings.hoverTranslateModifierKey}
            onChange={(event) =>
              updateSettings(
                { hoverTranslateModifierKey: event.target.value },
                "now",
              )
            }
            options={HOVER_TRANSLATE_MODIFIER_OPTIONS}
          />
          <span className="hint">
            按住选定按键可临时切换单词和整段；默认使用 Option / Alt。
          </span>

          <SettingNumberInput
            id="hoverTranslateDelayMs"
            label="悬停延迟"
            settingKey="hoverTranslateDelayMs"
            value={settings.hoverTranslateDelayMs}
            updateSettings={updateSettings}
            persistSettings={persistSettings}
            settingsRef={settingsRef}
            showAutoSaveStatus={showAutoSaveStatus}
            normalizer={normalizeHoverTranslateDelayMs}
            suffix="毫秒"
            min={0}
            max={5000}
            step={50}
            hint="鼠标停留多久后开始自动翻译，默认 200 毫秒。"
          />
        </>
      ) : null}
    </div>
  );
}
