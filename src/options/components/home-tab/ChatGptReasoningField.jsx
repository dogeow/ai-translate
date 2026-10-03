import { useEffect } from "react";
import {
  CHATGPT_REASONING_LABELS,
  getChatGptReasoningInfo,
  resolveChatGptReasoningEffort,
} from "../../../shared/chatgpt-reasoning.js";
import { FieldLabel } from "../common/InfoTip.jsx";

export function ChatGptReasoningField({ model, modelInfo, value, onChange }) {
  const info = getChatGptReasoningInfo(model, modelInfo);
  const selected = resolveChatGptReasoningEffort(model, value, modelInfo);

  useEffect(() => {
    // Do not overwrite a saved choice while fresh capabilities are still loading.
    if (
      Array.isArray(modelInfo?.supportedReasoningEfforts) &&
      value &&
      value !== selected
    )
      onChange("");
  }, [value, selected, modelInfo, onChange]);

  const defaultLabel = CHATGPT_REASONING_LABELS[info.defaultReasoningEffort];
  return (
    <div className="field">
      <FieldLabel tip="按当前模型支持的等级选择。等级越高，通常耗时和用量也越高；自动使用模型默认等级。">
        推理等级
      </FieldLabel>
      <select
        className="select"
        aria-label="推理等级"
        value={selected}
        disabled={info.supportedReasoningEfforts.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">自动（{defaultLabel || "模型默认"}）</option>
        {info.supportedReasoningEfforts.map((effort) => (
          <option key={effort} value={effort}>
            {CHATGPT_REASONING_LABELS[effort]}
          </option>
        ))}
        {info.supportsUltra && (
          <option value="ultra" disabled>
            Ultra（需 Codex 协作）
          </option>
        )}
      </select>
      {info.supportsUltra && (
        <p className="field-validation">
          Ultra 包含 Codex 子任务协作，当前扩展暂不提供。
        </p>
      )}
    </div>
  );
}
