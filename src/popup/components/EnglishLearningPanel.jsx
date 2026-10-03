import { useEffect, useState } from "react";
import { Panel } from "./Panel.jsx";
import { PopupModelField } from "./PopupModelField.jsx";
import {
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
} from "../../shared/word-learning.js";

export function EnglishLearningPanel({
  learningModeEnabled,
  learningModeSupported = true,
  onToggleLearningMode,
  provider,
  onProviderChange,
  availableModels = [],
  wordLookupProvider,
  onWordLookupProviderChange,
  wordLookupOptions = [],
  modelsLoading = false,
  onOpenProviderSetup,
}) {
  const [wordMarkingEnabled, setWordMarkingEnabled] = useState(false);
  const [recognitionModeEnabled, setRecognitionModeEnabled] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(
      [WORD_MARKING_ENABLED_KEY, WORD_RECOGNITION_MODE_ENABLED_KEY],
      (value) => {
        setWordMarkingEnabled(value?.[WORD_MARKING_ENABLED_KEY] === true);
        setRecognitionModeEnabled(
          value?.[WORD_RECOGNITION_MODE_ENABLED_KEY] === true,
        );
      },
    );
    function onChanged(changes, area) {
      if (area !== "sync") return;
      if (WORD_MARKING_ENABLED_KEY in changes) {
        setWordMarkingEnabled(
          changes[WORD_MARKING_ENABLED_KEY].newValue === true,
        );
      }
      if (WORD_RECOGNITION_MODE_ENABLED_KEY in changes) {
        setRecognitionModeEnabled(
          changes[WORD_RECOGNITION_MODE_ENABLED_KEY].newValue === true,
        );
      }
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  function toggleMark() {
    const next = !wordMarkingEnabled;
    setWordMarkingEnabled(next);
    chrome.storage.sync.set({ [WORD_MARKING_ENABLED_KEY]: next });
  }

  function toggleRecognitionMode() {
    const next = !recognitionModeEnabled;
    setRecognitionModeEnabled(next);
    chrome.storage.sync.set({
      [WORD_RECOGNITION_MODE_ENABLED_KEY]: next,
    });
  }

  return (
    <Panel
      title="阅读中学习"
      hint="查看句式解析，标记和巩固生词。"
      isSubtle
      className="popup-panel--learning"
    >
      <div className="popup-learning">
        <button
          type="button"
          className={`popup-learning-mode-switch${
            learningModeEnabled ? " is-active" : ""
          }`}
          onClick={onToggleLearningMode}
          disabled={!learningModeSupported}
          aria-pressed={learningModeEnabled}
          title={
            learningModeSupported
              ? learningModeEnabled
                ? "关闭学习模式"
                : "开启学习模式"
              : "请先添加并选择支持句型分析的学习模型"
          }
        >
          <span className="popup-learning-mode-switch__copy">
            <span className="popup-learning-mode-switch__title">句式分析</span>
            <span className="popup-learning-mode-switch__hint">
              {learningModeSupported
                ? "翻译后显示句式分析"
                : "需要先设置学习模型"}
            </span>
          </span>
          <span
            className="popup-learning-mode-switch__track"
            aria-hidden="true"
          >
            <span className="popup-learning-mode-switch__thumb" />
          </span>
        </button>
        <label className="popup-learning-toggle">
          <span className="popup-learning-toggle__copy">
            <span className="popup-learning-toggle__title">生词标记</span>
            <span className="popup-learning-toggle__hint">
              用橙色描边标记正在学习的单词
            </span>
          </span>
          <input
            className="popup-learning-toggle__input"
            type="checkbox"
            checked={wordMarkingEnabled}
            onChange={toggleMark}
          />
          <span className="popup-learning-toggle__control" aria-hidden="true">
            <span className="popup-learning-toggle__thumb" />
          </span>
        </label>
        <label className="popup-learning-toggle">
          <span className="popup-learning-toggle__copy">
            <span className="popup-learning-toggle__title">认词模式</span>
            <span className="popup-learning-toggle__hint">
              用蓝色描边识别页面中的其他单词
            </span>
          </span>
          <input
            className="popup-learning-toggle__input"
            type="checkbox"
            checked={recognitionModeEnabled}
            onChange={toggleRecognitionMode}
          />
          <span className="popup-learning-toggle__control" aria-hidden="true">
            <span className="popup-learning-toggle__thumb" />
          </span>
        </label>
        <details className="popup-model-settings">
          <summary>
            模型与词典
            <span>
              调整
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 4 4 4-4 4" />
              </svg>
            </span>
          </summary>
          <div className="popup-model-settings__content">
            <PopupModelField
              id="popup-word-lookup-provider"
              label="单词释义"
              value={wordLookupProvider}
              onChange={onWordLookupProviderChange}
              options={wordLookupOptions}
              isLoading={modelsLoading}
              onOpenSetup={onOpenProviderSetup}
              className="popup-field--flush"
            />
            <PopupModelField
              id="popup-learning-model"
              label="学习模型"
              value={provider}
              onChange={onProviderChange}
              options={availableModels}
              isLoading={modelsLoading}
              onOpenSetup={onOpenProviderSetup}
              className="popup-field--flush"
            />
          </div>
        </details>
      </div>
    </Panel>
  );
}
