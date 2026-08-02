import { useCallback, useEffect, useMemo, useState } from "react";

import {
  WORD_MARKING_ENABLED_KEY,
  WORD_RECOGNITION_MODE_ENABLED_KEY,
  buildReviewSummary,
} from "../../../shared/word-learning.js";
import { buildWordLearningExport } from "../../../shared/word-learning-transfer.js";
import { buildWordLearningList } from "./wordLearningView.js";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

const EXPORT_LABELS = {
  all: "全部单词",
  studying: "学习中",
  known: "我会的",
};

function downloadJson(data, filename) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportFilename(scope) {
  const date = new Date().toISOString().slice(0, 10);
  return `english-learning-${scope}-${date}.json`;
}

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
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferStatus, setTransferStatus] = useState(null);

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

  const exportWords = useCallback(
    (scope) => {
      const data = buildWordLearningExport({ known, studying }, scope);
      downloadJson(data, exportFilename(scope));
      const count = data.known.length + data.studying.length;
      setTransferStatus({
        type: "success",
        text: `已导出${EXPORT_LABELS[scope]} ${count} 个。`,
      });
    },
    [known, studying],
  );

  const importFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        setTransferStatus({
          type: "error",
          text: "文件不能超过 5 MB。",
        });
        return;
      }

      setTransferBusy(true);
      setTransferStatus({ type: "info", text: "正在导入…" });
      try {
        const data = await file.text();
        const response = await sendWordLearningMessage({
          action: "importWordLearningData",
          data,
        });
        if (!response?.ok) {
          setTransferStatus({
            type: "error",
            text: response?.error || "导入失败，请重试。",
          });
          return;
        }

        await reload();
        const added = response.addedStudying + response.addedKnown;
        setTransferStatus({
          type: "success",
          text: added
            ? `已导入：学习中 ${response.addedStudying} 个，我会的 ${response.addedKnown} 个；跳过 ${response.skipped} 个。`
            : `没有新增单词，已跳过 ${response.skipped} 个已有或无效单词。`,
        });
      } catch (_) {
        setTransferStatus({ type: "error", text: "读取文件失败，请重试。" });
      } finally {
        setTransferBusy(false);
      }
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
      exportAll: () => exportWords("all"),
      exportStudying: () => exportWords("studying"),
      exportKnown: () => exportWords("known"),
      importFile,
    }),
    [addWord, exportWords, importFile, runWordAction],
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
    transferBusy,
    transferStatus,
  };
}
