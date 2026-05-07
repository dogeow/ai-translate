import { useEffect, useState, useCallback } from "react";
import {
  WORD_MARKING_ENABLED_KEY,
  INTERVAL_LEVELS,
  formatIntervalShort,
  buildReviewSummary,
  isStudyingVisibleNow,
} from "../../shared/word-learning.js";
import { buildYoudaoAudioUrl } from "../../shared/youdao-api.js";

function sendBg(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function playAudio(word, type) {
  try {
    const audio = new Audio(buildYoudaoAudioUrl(word, type));
    audio.play().catch(() => {});
  } catch (_) {}
}

function formatDate(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function levelLabel(entry) {
  const level = entry?.level ?? -1;
  if (level < 0) return "新词";
  return `L${level + 1} · ${formatIntervalShort(INTERVAL_LEVELS[level])}`;
}

export function WordLearningTab() {
  const [enabled, setEnabled] = useState(false);
  const [known, setKnown] = useState({});
  const [studying, setStudying] = useState({});
  const [filter, setFilter] = useState("");
  const [newWord, setNewWord] = useState("");
  const [tab, setTab] = useState("studying");

  const reload = useCallback(async () => {
    const res = await sendBg({ action: "getAllWords" });
    if (res?.ok) {
      setKnown(res.known || {});
      setStudying(res.studying || {});
    }
  }, []);

  useEffect(() => {
    chrome.storage.sync.get([WORD_MARKING_ENABLED_KEY], (v) => {
      setEnabled(v?.[WORD_MARKING_ENABLED_KEY] === true);
    });
    void reload();
    function onChanged(changes, area) {
      if (area === "sync" && WORD_MARKING_ENABLED_KEY in changes) {
        setEnabled(changes[WORD_MARKING_ENABLED_KEY].newValue === true);
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

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.sync.set({ [WORD_MARKING_ENABLED_KEY]: next });
  }

  async function addStudying() {
    const w = newWord.trim();
    if (!w) return;
    const res = await sendBg({ action: "addStudyingWord", word: w });
    if (res?.ok) {
      setNewWord("");
      await reload();
    }
  }

  async function addKnown() {
    const w = newWord.trim();
    if (!w) return;
    const res = await sendBg({ action: "addKnownWord", word: w });
    if (res?.ok) {
      setNewWord("");
      await reload();
    }
  }

  async function review(word, action) {
    await sendBg({ action: "reviewWord", word, reviewAction: action });
    await reload();
  }

  async function moveToKnown(word) {
    await sendBg({ action: "addKnownWord", word });
    await reload();
  }

  async function removeStudying(word) {
    await sendBg({ action: "removeStudyingWord", word });
    await reload();
  }

  async function removeKnown(word) {
    await sendBg({ action: "removeKnownWord", word });
    await reload();
  }

  const studyingList = Object.entries(studying)
    .map(([word, entry]) => ({ word, ...entry }))
    .filter((e) => !filter || e.word.includes(filter.toLowerCase()))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const knownList = Object.entries(known)
    .map(([word, entry]) => ({ word, ...entry }))
    .filter((e) => !filter || e.word.includes(filter.toLowerCase()))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  const summary = buildReviewSummary(studying);

  return (
    <div className="card">
      <h2>英语学习</h2>
      <p className="hint">
        开启「生词标记」后，学习中的单词会在网页上以下划虚线标出；鼠标悬停可查看音标、发音并打分（记得 / 忘记 / 我会）。
      </p>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="checkbox-label" htmlFor="wordMarkingEnabled">
          <input
            id="wordMarkingEnabled"
            type="checkbox"
            checked={enabled}
            onChange={toggleEnabled}
          />
          <span>开启生词标记</span>
        </label>
        <span className="hint" style={{ marginLeft: 8 }}>
          学习中 {Object.keys(studying).length} · 我会 {Object.keys(known).length} · 当前可见 {summary.due.length}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="添加单词…"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          style={{
            flex: "1 1 200px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            padding: "6px 10px",
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={addStudying}>
          加入学习中
        </button>
        <button type="button" className="btn btn-secondary" onClick={addKnown}>
          加入我会的
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, borderBottom: "1px solid var(--border-subtle)" }}>
        {[
          { id: "studying", label: `学习中 (${studyingList.length})` },
          { id: "known", label: `我会的 (${knownList.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              background: "transparent",
              border: 0,
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
        <input
          type="search"
          placeholder="筛选…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            marginLeft: "auto",
            background: "var(--bg-input)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            padding: "4px 8px",
            fontSize: 12,
          }}
        />
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {tab === "studying" ? (
          studyingList.length === 0 ? (
            <div className="hint">暂无学习中的单词。在网页上选中后右键，或在上方添加。</div>
          ) : (
            studyingList.map((entry) => {
              const visible = isStudyingVisibleNow(entry);
              return (
                <div
                  key={entry.word}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    background: visible ? "var(--bg-elevated)" : "var(--bg-surface)",
                  }}
                >
                  <strong style={{ color: "var(--text-primary)", minWidth: 120 }}>
                    {entry.word}
                  </strong>
                  <span className="hint" style={{ fontSize: 11 }}>
                    {levelLabel(entry)} · 下次 {entry.nextReviewAt ? formatDate(entry.nextReviewAt) : "立即"}
                  </span>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => playAudio(entry.word, 1)}>UK</button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => playAudio(entry.word, 2)}>US</button>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => review(entry.word, "forget")}>忘记</button>
                    <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => review(entry.word, "remember")}>记得</button>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => moveToKnown(entry.word)}>我会</button>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 12, color: "var(--error-text)" }} onClick={() => removeStudying(entry.word)}>移除</button>
                  </span>
                </div>
              );
            })
          )
        ) : knownList.length === 0 ? (
          <div className="hint">暂无已知单词。</div>
        ) : (
          knownList.map((entry) => (
            <div
              key={entry.word}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
              }}
            >
              <strong style={{ color: "var(--text-primary)", minWidth: 120 }}>
                {entry.word}
              </strong>
              <span className="hint" style={{ fontSize: 11 }}>
                加入于 {formatDate(entry.addedAt)}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => playAudio(entry.word, 1)}>UK</button>
                <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => playAudio(entry.word, 2)}>US</button>
                <button type="button" className="btn btn-secondary" style={{ fontSize: 12, color: "var(--error-text)" }} onClick={() => removeKnown(entry.word)}>移除</button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
