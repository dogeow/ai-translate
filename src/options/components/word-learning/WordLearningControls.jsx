import { useRef } from "react";

export function WordLearningSettings({
  dueCount,
  enabled,
  knownCount,
  onToggleEnabled,
  onToggleRecognitionMode,
  recognitionModeEnabled,
  studyingCount,
}) {
  return (
    <div className="word-learning-settings">
      <div className="field word-learning-setting">
        <label className="checkbox-label" htmlFor="wordMarkingEnabled">
          <input
            id="wordMarkingEnabled"
            type="checkbox"
            checked={enabled}
            onChange={onToggleEnabled}
          />
          <span>开启生词标记</span>
        </label>
        <span className="hint word-learning-setting__hint">
          学习中 {studyingCount} · 我会 {knownCount} · 当前可见 {dueCount}
        </span>
      </div>

      <div className="field word-learning-setting">
        <label
          className="checkbox-label"
          htmlFor="wordRecognitionModeEnabled"
        >
          <input
            id="wordRecognitionModeEnabled"
            type="checkbox"
            checked={recognitionModeEnabled}
            onChange={onToggleRecognitionMode}
          />
          <span>开启认词模式</span>
        </label>
        <span className="hint word-learning-setting__hint">
          除“我会的”以外，网页中的英文单词全部加下划线
        </span>
      </div>
    </div>
  );
}

export function WordLearningTransferControls({
  busy,
  knownCount,
  onExportAll,
  onExportKnown,
  onExportStudying,
  onImportFile,
  status,
  studyingCount,
}) {
  const inputRef = useRef(null);
  const totalCount = knownCount + studyingCount;

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onImportFile(file);
  }

  return (
    <section className="word-learning-transfer" aria-labelledby="word-transfer-title">
      <div className="word-learning-transfer__heading">
        <div>
          <h3 id="word-transfer-title">导入与导出</h3>
          <p className="hint">
            保留分类和复习进度；导入只合并新单词，不覆盖本机数据。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "导入中…" : "导入单词"}
        </button>
        <input
          ref={inputRef}
          className="word-learning-transfer__input"
          type="file"
          accept=".json,.txt,application/json,text/plain"
          onChange={handleFileChange}
        />
      </div>

      <div className="word-learning-transfer__actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={totalCount === 0}
          onClick={onExportAll}
        >
          导出全部 ({totalCount})
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={studyingCount === 0}
          onClick={onExportStudying}
        >
          导出学习中 ({studyingCount})
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={knownCount === 0}
          onClick={onExportKnown}
        >
          导出我会的 ({knownCount})
        </button>
      </div>

      {status ? (
        <p
          className={`word-learning-transfer__status word-learning-transfer__status--${status.type}`}
          role="status"
        >
          {status.text}
        </p>
      ) : null}
    </section>
  );
}

export function WordLearningAddForm({
  newWord,
  onAddKnown,
  onAddStudying,
  onNewWordChange,
}) {
  return (
    <div className="word-learning-add">
      <input
        type="text"
        className="field-input word-learning-add__input"
        placeholder="添加单词…"
        value={newWord}
        onChange={(event) => onNewWordChange(event.target.value)}
      />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onAddStudying}
      >
        加入学习中
      </button>
      <button type="button" className="btn btn-secondary" onClick={onAddKnown}>
        加入我会的
      </button>
    </div>
  );
}

export function WordLearningToolbar({
  filter,
  knownCount,
  onFilterChange,
  onTabChange,
  studyingCount,
  tab,
}) {
  const tabs = [
    { id: "studying", label: `学习中 (${studyingCount})` },
    { id: "known", label: `我会的 (${knownCount})` },
  ];

  return (
    <div className="word-learning-toolbar">
      <span className="word-learning-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`word-learning-tab${
              tab === item.id ? " word-learning-tab--active" : ""
            }`}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </span>
      <input
        type="search"
        className="word-learning-filter"
        aria-label="筛选单词"
        placeholder="筛选…"
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
      />
    </div>
  );
}
