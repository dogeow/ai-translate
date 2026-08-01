import { isLearningModeSupported } from "../lib/learningSettings.js";

export function LearningTab({ settings, updateSettings }) {
  const isSupported = isLearningModeSupported(settings);
  const checked = isSupported && !!settings.learningModeEnabled;

  return (
    <div className="card">
      <h2>学习模式</h2>
      <div className="field">
        <label
          className={`checkbox-label${isSupported ? "" : " checkbox-label--disabled"}`}
          htmlFor="learningModeEnabled"
          title={
            !isSupported
              ? "Chrome 内置 AI 仅支持翻译，不支持句型分析。请切换学习模型。"
              : undefined
          }
        >
          <input
            id="learningModeEnabled"
            type="checkbox"
            checked={checked}
            disabled={!isSupported}
            onChange={(event) =>
              updateSettings(
                { learningModeEnabled: event.target.checked },
                "now",
              )
            }
          />
          <span>启用学习模式</span>
        </label>
        {!isSupported ? (
          <span className="hint hint--warn">
            当前学习模型是 Chrome 内置 AI，仅支持翻译，不支持句型分析。请在弹窗中切换学习模型。
          </span>
        ) : (
          <span className="hint">
            开启后，翻译完成的 tip
            弹窗会追加主句结构、句法拆分和学习说明。默认关闭，以减少额外分析带来的等待时间。
          </span>
        )}
      </div>
    </div>
  );
}
