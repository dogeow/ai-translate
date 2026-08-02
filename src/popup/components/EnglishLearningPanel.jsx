import { useEffect, useState } from "react";
import { Panel } from "./Panel.jsx";
import { PopupModelField } from "./PopupModelField.jsx";
import {
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
} from "../../shared/word-learning.js";

export function EnglishLearningPanel({
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
    <Panel title="英语学习" isSubtle className="popup-panel--learning">
      <div className="popup-learning">
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
        <label className="popup-learning-toggle">
          <span className="popup-learning-toggle__copy">
            <span className="popup-learning-toggle__title">生词标记</span>
            <span className="popup-learning-toggle__hint">
              用橙色边框方框标记学习中的单词
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
              用蓝色边框方框标记其他单词
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
      </div>
    </Panel>
  );
}
