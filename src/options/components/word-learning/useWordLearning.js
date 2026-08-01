import { useCallback, useEffect, useMemo, useState } from "react";

import {
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
  buildReviewSummary,
} from "../../../shared/word-learning.js";
import { buildWordLearningList } from "./wordLearningView.js";

function sendWordLearningMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

export function useWordLearning() {
  const [enabled, setEnabled] = useState(false);
  const [recognitionModeEnabled, setRecognitionModeEnabled] = useState(false);
  const [known, setKnown] = useState({});
  const [studying, setStudying] = useState({});
  const [filter, setFilter] = useState("");
  const [newWord, setNewWord] = useState("");
  const [tab, setTab] = useState("studying");

  const reload = useCallback(async () => {
    const response = await sendWordLearningMessage({ action: "getAllWords" });
    if (!response?.ok) return;
    setKnown(response.known || {});
    setStudying(response.studying || {});
  }, []);

  useEffect(() => {
    chrome.storage.sync.get(
      [WORD_MARKING_ENABLED_KEY, WORD_RECOGNITION_MODE_ENABLED_KEY],
      (value) => {
        setEnabled(value?.[WORD_MARKING_ENABLED_KEY] === true);
        setRecognitionModeEnabled(
          value?.[WORD_RECOGNITION_MODE_ENABLED_KEY] === true,
        );
      },
    );
    void reload();

    function onChanged(changes, area) {
      if (area === "sync") {
        if (WORD_MARKING_ENABLED_KEY in changes) {
          setEnabled(changes[WORD_MARKING_ENABLED_KEY].newValue === true);
        }
        if (WORD_RECOGNITION_MODE_ENABLED_KEY in changes) {
          setRecognitionModeEnabled(
            changes[WORD_RECOGNITION_MODE_ENABLED_KEY].newValue === true,
          );
        }
      }
      if (
        area === "local" &&
        ("studyingWords" in changes || "knownWords" in changes)
      ) {
        void reload();
      }
    }

    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [reload]);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      chrome.storage.sync.set({ [WORD_MARKING_ENABLED_KEY]: next });
      return next;
    });
  }, []);

  const toggleRecognitionMode = useCallback(() => {
    setRecognitionModeEnabled((current) => {
      const next = !current;
      chrome.storage.sync.set({
        [WORD_RECOGNITION_MODE_ENABLED_KEY]: next,
      });
      return next;
    });
  }, []);

  const addWord = useCallback(
    async (target) => {
      const word = newWord.trim();
      if (!word) return;
      const action =
        target === "known" ? "addKnownWord" : "addStudyingWord";
      const response = await sendWordLearningMessage({ action, word });
      if (!response?.ok) return;
      setNewWord("");
      await reload();
    },
    [newWord, reload],
  );

  const runWordAction = useCallback(
    async (message) => {
      await sendWordLearningMessage(message);
      await reload();
    },
    [reload],
  );

  const actions = useMemo(
    () => ({
      addStudying: () => addWord("studying"),
      addKnown: () => addWord("known"),
      review: (word, reviewAction) =>
        runWordAction({ action: "reviewWord", word, reviewAction }),
      moveToKnown: (word) =>
        runWordAction({ action: "addKnownWord", word }),
      removeStudying: (word) =>
        runWordAction({ action: "removeStudyingWord", word }),
      removeKnown: (word) =>
        runWordAction({ action: "removeKnownWord", word }),
    }),
    [addWord, runWordAction],
  );

  const studyingList = useMemo(
    () => buildWordLearningList(studying, filter),
    [filter, studying],
  );
  const knownList = useMemo(
    () => buildWordLearningList(known, filter),
    [filter, known],
  );
  const summary = useMemo(() => buildReviewSummary(studying), [studying]);

  return {
    actions,
    enabled,
    filter,
    knownCount: Object.keys(known).length,
    knownList,
    newWord,
    recognitionModeEnabled,
    setFilter,
    setNewWord,
    setTab,
    studyingCount: Object.keys(studying).length,
    studyingList,
    summary,
    tab,
    toggleEnabled,
    toggleRecognitionMode,
  };
}
