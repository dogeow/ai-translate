import {
  WordLearningAddForm,
  WordLearningSettings,
  WordLearningTransferControls,
  WordLearningToolbar,
} from "./word-learning/WordLearningControls.jsx";
import { WordLearningList } from "./word-learning/WordLearningList.jsx";
import { DogeowCloudSync } from "./word-learning/DogeowCloudSync.jsx";
import { useWordLearning } from "./word-learning/useWordLearning.js";

export function WordLearningTab() {
  const {
    actions,
    enabled,
    filter,
    knownCount,
    knownList,
    newWord,
    recognitionModeEnabled,
    setFilter,
    setNewWord,
    setTab,
    studyingCount,
    studyingList,
    summary,
    tab,
    toggleEnabled,
    toggleRecognitionMode,
    transferBusy,
    transferStatus,
  } = useWordLearning();

  return (
    <div className="card word-learning-card">
      <header className="word-learning-header">
        <div className="word-learning-header__copy">
          <h2>英语学习</h2>
          <p className="hint">
            复习和管理单词；网页标记、认词模式及数据迁移可在下方设置中调整。
          </p>
        </div>
        <div className="word-learning-overview" aria-label="单词学习概况">
          <span className="word-learning-overview__item">
            <strong>{studyingCount}</strong>
            <span>学习中</span>
          </span>
          <span className="word-learning-overview__item">
            <strong>{knownCount}</strong>
            <span>我会的</span>
          </span>
          <span className="word-learning-overview__item word-learning-overview__item--due">
            <strong>{summary.due.length}</strong>
            <span>待复习</span>
          </span>
        </div>
      </header>

      <details className="word-learning-management">
        <summary>
          <span className="word-learning-management__title">设置与数据</span>
          <span className="word-learning-management__state">
            {enabled ? "生词标记已开启" : "生词标记已关闭"} ·{" "}
            {recognitionModeEnabled ? "认词模式已开启" : "认词模式已关闭"}
          </span>
        </summary>
        <div className="word-learning-management__body">
          <WordLearningSettings
            dueCount={summary.due.length}
            enabled={enabled}
            knownCount={knownCount}
            onToggleEnabled={toggleEnabled}
            onToggleRecognitionMode={toggleRecognitionMode}
            recognitionModeEnabled={recognitionModeEnabled}
            studyingCount={studyingCount}
          />
          <DogeowCloudSync />
          <WordLearningTransferControls
            busy={transferBusy}
            knownCount={knownCount}
            onExportAll={actions.exportAll}
            onExportKnown={actions.exportKnown}
            onExportStudying={actions.exportStudying}
            onImportFile={actions.importFile}
            status={transferStatus}
            studyingCount={studyingCount}
          />
        </div>
      </details>

      <section className="word-learning-library" aria-label="单词列表">
        <WordLearningToolbar
          filter={filter}
          knownCount={knownList.length}
          onFilterChange={setFilter}
          onTabChange={setTab}
          studyingCount={studyingList.length}
          tab={tab}
        />
        <WordLearningAddForm
          newWord={newWord}
          onAddKnown={actions.addKnown}
          onAddStudying={actions.addStudying}
          onNewWordChange={setNewWord}
        />
        <WordLearningList
          actions={actions}
          knownList={knownList}
          studyingList={studyingList}
          tab={tab}
        />
      </section>
    </div>
  );
}
