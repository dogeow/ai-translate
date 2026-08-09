import {
  CHATGPT_MODEL_FALLBACK_LIST,
  DEFAULT_CHATGPT_MODEL,
  DEFAULT_GITHUB_MODEL,
} from "../../../shared/constants.js";
import { ModelDropdown } from "../ModelDropdown.jsx";
import { AutoSaveInputField } from "../common/AutoSaveField.jsx";
import { FieldLabel } from "../common/InfoTip.jsx";
import { FIELD_IDS } from "./constants.js";

function buildChatGptModelOptions(models, selected) {
  const names = [];
  const seen = new Set();
  const push = (name) => {
    const value = String(name || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    names.push(value);
  };

  // 已探测到的账号模型优先
  for (const item of Array.isArray(models) ? models : []) {
    push(typeof item === "string" ? item : item?.name);
  }
  // 未探测或探测结果较少时，补上常见候选，避免下拉只剩一个
  if (names.length <= 1) {
    for (const name of CHATGPT_MODEL_FALLBACK_LIST) push(name);
  }
  push(selected || DEFAULT_CHATGPT_MODEL);
  return names.map((name) => ({ name }));
}

export function ProviderModelField({
  isMiniMax,
  isGitHub,
  isChatGpt,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  modelDropdownRef,
  allowManualOllamaModel = false,
}) {
  if (isMiniMax) {
    return (
      <AutoSaveInputField
        id={FIELD_IDS.providerModel}
        label="模型"
        placeholder="输入 MiniMax 模型，例如 MiniMax-M2.5-highspeed"
        value={settings.minimaxModel}
        settingKey="minimaxModel"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    );
  }

  if (isGitHub) {
    if (models.length > 0) {
      return (
        <div className="field">
          <label id={`${FIELD_IDS.providerModel}-label`}>模型</label>
          <ModelDropdown
            models={models}
            selectedValue={settings.githubModel}
            disabled={false}
            isOpen={modelDropdownOpen}
            onToggle={() => setModelDropdownOpen((value) => !value)}
            onSelect={(name) => {
              updateSettings({ githubModel: name }, "now");
              void persistSettings(settingsRef.current);
              setModelDropdownOpen(false);
            }}
            dropdownRef={modelDropdownRef}
          />
        </div>
      );
    }

    return (
      <AutoSaveInputField
        id={FIELD_IDS.providerModel}
        label="模型"
        placeholder={DEFAULT_GITHUB_MODEL}
        value={settings.githubModel}
        settingKey="githubModel"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    );
  }

  if (isChatGpt) {
    const selected =
      String(settings.chatgptModel || "").trim() || DEFAULT_CHATGPT_MODEL;
    const chatgptModels = buildChatGptModelOptions(models, selected);
    const probed = Array.isArray(models) && models.length > 1;

    return (
      <div className="field">
        <FieldLabel
          tip={
            probed
              ? "列表来自当前 ChatGPT 账号的 Codex 可用模型。"
              : "先展示常见 GPT-5.6 候选。登录后点「测试连接」会按账号权限刷新完整列表。"
          }
        >
          模型
        </FieldLabel>
        <ModelDropdown
          models={chatgptModels}
          selectedValue={selected}
          disabled={false}
          isOpen={modelDropdownOpen}
          onToggle={() => setModelDropdownOpen((value) => !value)}
          onSelect={(name) => {
            updateSettings({ chatgptModel: name }, "now");
            void persistSettings(settingsRef.current);
            setModelDropdownOpen(false);
          }}
          dropdownRef={modelDropdownRef}
        />
      </div>
    );
  }

  if (allowManualOllamaModel && models.length === 0) {
    return (
      <AutoSaveInputField
        id={FIELD_IDS.providerModel}
        label="模型"
        placeholder="输入 Ollama 模型，例如 qwen2.5:7b"
        value={settings.ollamaModel}
        settingKey="ollamaModel"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    );
  }

  return (
    <div className="field">
      <label id={`${FIELD_IDS.providerModel}-label`}>模型</label>
      <ModelDropdown
        models={models}
        selectedValue={settings.ollamaModel}
        disabled={models.length === 0}
        isOpen={modelDropdownOpen}
        onToggle={() => setModelDropdownOpen((value) => !value)}
        onSelect={(name) => {
          updateSettings({ ollamaModel: name }, "now");
          void persistSettings(settingsRef.current);
          setModelDropdownOpen(false);
        }}
        dropdownRef={modelDropdownRef}
      />
    </div>
  );
}
