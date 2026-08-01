import { isStudyingVisibleNow } from "../../../shared/word-learning.js";
import { PronunciationLinks } from "./PronunciationLinks.jsx";
import {
  formatWordLearningDate,
  getWordLearningLevelLabel,
} from "./wordLearningView.js";

function StudyingWordRow({
  entry,
  onMoveToKnown,
  onRemove,
  onReview,
}) {
  const visible = isStudyingVisibleNow(entry);

  return (
    <div
      className={`word-learning-item${
        visible ? " word-learning-item--visible" : ""
      }`}
    >
      <span className="word-learning-item__details">
        <span className="word-learning-item__term-row">
          <strong className="word-learning-item__term">{entry.word}</strong>
          <PronunciationLinks word={entry.word} />
        </span>
        <span className="word-learning-item__meta">
          {getWordLearningLevelLabel(entry)} · 下次{" "}
          {entry.nextReviewAt
            ? formatWordLearningDate(entry.nextReviewAt)
            : "立即"}
        </span>
      </span>
      <span className="word-learning-item__actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onReview(entry.word, "forget")}
        >
          忘记
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onReview(entry.word, "remember")}
        >
          记得
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onMoveToKnown(entry.word)}
        >
          我会
        </button>
        <button
          type="button"
          className="btn btn-secondary word-learning-item__remove"
          onClick={() => onRemove(entry.word)}
        >
          移除
        </button>
      </span>
    </div>
  );
}

function KnownWordRow({ entry, onRemove }) {
  return (
    <div className="word-learning-item">
      <span className="word-learning-item__details">
        <span className="word-learning-item__term-row">
          <strong className="word-learning-item__term">{entry.word}</strong>
          <PronunciationLinks word={entry.word} />
        </span>
        <span className="word-learning-item__meta">
          加入于 {formatWordLearningDate(entry.addedAt)}
        </span>
      </span>
      <span className="word-learning-item__actions">
        <button
          type="button"
          className="btn btn-secondary word-learning-item__remove"
          onClick={() => onRemove(entry.word)}
        >
          移除
        </button>
      </span>
    </div>
  );
}

export function WordLearningList({
  actions,
  knownList,
  studyingList,
  tab,
}) {
  if (tab === "studying" && studyingList.length === 0) {
    return (
      <div className="hint">
        暂无学习中的单词。在网页上选中后右键，或在上方添加。
      </div>
    );
  }

  if (tab === "known" && knownList.length === 0) {
    return <div className="hint">暂无已知单词。</div>;
  }

  return (
    <div className="word-learning-list">
      {tab === "studying"
        ? studyingList.map((entry) => (
            <StudyingWordRow
              key={entry.word}
              entry={entry}
              onMoveToKnown={actions.moveToKnown}
              onRemove={actions.removeStudying}
              onReview={actions.review}
            />
          ))
        : knownList.map((entry) => (
            <KnownWordRow
              key={entry.word}
              entry={entry}
              onRemove={actions.removeKnown}
            />
          ))}
    </div>
  );
}
