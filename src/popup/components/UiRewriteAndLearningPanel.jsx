import { useEffect, useState } from "react";
import { Panel } from "./Panel.jsx";
import { WORD_MARKING_ENABLED_KEY } from "../../shared/word-learning.js";

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0] || null);
    });
  });
}

export function UiRewriteAndLearningPanel() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [wordMarkingEnabled, setWordMarkingEnabled] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get([WORD_MARKING_ENABLED_KEY], (value) => {
      setWordMarkingEnabled(value?.[WORD_MARKING_ENABLED_KEY] === true);
    });
    function onChanged(changes, area) {
      if (area === "sync" && WORD_MARKING_ENABLED_KEY in changes) {
        setWordMarkingEnabled(
          changes[WORD_MARKING_ENABLED_KEY].newValue === true,
        );
      }
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  function setMessage(text, tone = "neutral") {
    setStatus(text);
    setStatusTone(tone);
    if (text) {
      window.setTimeout(() => setStatus(""), 2200);
    }
  }

  async function submit() {
    const text = prompt.trim();
    if (!text) {
      setMessage("请输入改造需求", "error");
      return;
    }
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      setMessage("当前页面不支持（仅 http/https）", "error");
      return;
    }
    setBusy(true);
    setMessage("AI 生成中…", "neutral");
    chrome.runtime.sendMessage(
      {
        action: "generateUiRewrite",
        tabId: tab.id,
        url: tab.url,
        title: tab.title || "",
        prompt: text,
      },
      (res) => {
        setBusy(false);
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message, "error");
          return;
        }
        if (res?.ok) {
          setMessage("已应用到当前页", "success");
          setPrompt("");
        } else {
          setMessage(res?.error || "生成失败", "error");
        }
      },
    );
  }

  function toggleMark() {
    const next = !wordMarkingEnabled;
    setWordMarkingEnabled(next);
    chrome.storage.sync.set({ [WORD_MARKING_ENABLED_KEY]: next });
  }

  return (
    <Panel
      title="AI 页面改造 / 英语学习"
      isSubtle
      showStatus={!!status}
      statusText={status}
      statusTone={statusTone}
    >
      <div className="popup-rewrite">
        <textarea
          rows={2}
          className="popup-rewrite__input"
          value={prompt}
          placeholder="一句话描述想改成什么样…（如：背景米色，正文调大）"
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="btn btn-primary popup-rewrite__btn"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "生成中…" : "AI 改造当前页"}
        </button>
      </div>
      <div className="popup-rewrite__divider" />
      <label className="popup-rewrite__toggle">
        <input
          type="checkbox"
          checked={wordMarkingEnabled}
          onChange={toggleMark}
        />
        <span>开启生词标记（在网页上为学习中的单词加下划线）</span>
      </label>
    </Panel>
  );
}
