import {
  WordLearningAddForm,
  WordLearningSettings,
  WordLearningToolbar,
} from "./word-learning/WordLearningControls.jsx";
import { WordLearningList } from "./word-learning/WordLearningList.jsx";
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
  } = useWordLearning();

  return (
    <div className="card">
      <h2>英语学习</h2>
      <p className="hint">
        生词标记只显示学习中的单词；认词模式会显示除熟词外的所有英文单词。鼠标悬停可查看音标、发音并分类。
      </p>

      <WordLearningSettings
        dueCount={summary.due.length}
        enabled={enabled}
        knownCount={knownCount}
        onToggleEnabled={toggleEnabled}
        onToggleRecognitionMode={toggleRecognitionMode}
        recognitionModeEnabled={recognitionModeEnabled}
        studyingCount={studyingCount}
      />
      <WordLearningAddForm
        newWord={newWord}
        onAddKnown={actions.addKnown}
        onAddStudying={actions.addStudying}
        onNewWordChange={setNewWord}
      />
      <WordLearningToolbar
        filter={filter}
        knownCount={knownList.length}
        onFilterChange={setFilter}
        onTabChange={setTab}
        studyingCount={studyingList.length}
        tab={tab}
      />
      <WordLearningList
        actions={actions}
        knownList={knownList}
        studyingList={studyingList}
        tab={tab}
      />
    </div>
  );
}
