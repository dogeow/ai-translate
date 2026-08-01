import assert from "node:assert/strict";
import test from "node:test";
import {
  isWordMarkerActive,
  resolveWordMarkKind,
  shouldPreferWordMarkerCard,
  WORD_MARK_KIND,
} from "./wordMarkerPolicy.js";

test("regular word marking only shows due studying words", () => {
  const context = {
    wordMarkingEnabled: true,
    studyingWords: {
      due: { nextReviewAt: null },
      later: { nextReviewAt: 200 },
    },
    now: 100,
  };

  assert.equal(
    resolveWordMarkKind("due", context),
    WORD_MARK_KIND.STUDYING,
  );
  assert.equal(resolveWordMarkKind("later", context), WORD_MARK_KIND.NONE);
  assert.equal(resolveWordMarkKind("other", context), WORD_MARK_KIND.NONE);
});

test("recognition mode marks every English word except known words", () => {
  const context = {
    recognitionModeEnabled: true,
    knownWords: { familiar: {} },
    studyingWords: { learning: { nextReviewAt: 999 } },
    now: 100,
  };

  assert.equal(
    resolveWordMarkKind("unmarked", context),
    WORD_MARK_KIND.RECOGNITION,
  );
  assert.equal(
    resolveWordMarkKind("learning", context),
    WORD_MARK_KIND.STUDYING,
  );
  assert.equal(resolveWordMarkKind("familiar", context), WORD_MARK_KIND.NONE);
});

test("recognition mode includes valid one-letter English words", () => {
  const context = { recognitionModeEnabled: true };
  assert.equal(resolveWordMarkKind("A", context), WORD_MARK_KIND.RECOGNITION);
  assert.equal(resolveWordMarkKind("I", context), WORD_MARK_KIND.RECOGNITION);
  assert.equal(resolveWordMarkKind("x", context), WORD_MARK_KIND.NONE);
});

test("either setting activates the marker", () => {
  assert.equal(isWordMarkerActive(), false);
  assert.equal(isWordMarkerActive({ wordMarkingEnabled: true }), true);
  assert.equal(isWordMarkerActive({ recognitionModeEnabled: true }), true);
});

test("认词单词优先词典卡片，段落范围优先翻译弹窗", () => {
  assert.equal(
    shouldPreferWordMarkerCard({
      isMarkedWord: true,
      effectiveScope: "word",
    }),
    true,
  );
  assert.equal(
    shouldPreferWordMarkerCard({
      isMarkedWord: true,
      effectiveScope: "paragraph",
    }),
    false,
  );
  assert.equal(
    shouldPreferWordMarkerCard({
      isMarkedWord: false,
      effectiveScope: "word",
    }),
    false,
  );
});
