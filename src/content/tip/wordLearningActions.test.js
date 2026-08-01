import assert from "node:assert/strict";
import test from "node:test";
import {
  getSingleEnglishWord,
  isEditableShortcutTarget,
  resolveWordLearningShortcut,
  WORD_LEARNING_STATUS,
} from "./wordLearningActions.js";

test("extracts a single English word with surrounding punctuation", () => {
  assert.equal(getSingleEnglishWord("though."), "though");
  assert.equal(getSingleEnglishWord("“Well-known!”"), "well-known");
  assert.equal(getSingleEnglishWord("don't"), "don't");
});

test("rejects phrases and non-English text", () => {
  assert.equal(getSingleEnglishWord("two words"), "");
  assert.equal(getSingleEnglishWord("中文"), "");
  assert.equal(getSingleEnglishWord(""), "");
});

test("maps local Option shortcuts to word learning statuses", () => {
  assert.equal(
    resolveWordLearningShortcut({ altKey: true, code: "Digit1" }),
    WORD_LEARNING_STATUS.STUDYING,
  );
  assert.equal(
    resolveWordLearningShortcut({ altKey: true, code: "Digit2" }),
    WORD_LEARNING_STATUS.KNOWN,
  );
  assert.equal(
    resolveWordLearningShortcut({
      altKey: true,
      shiftKey: true,
      code: "Digit1",
    }),
    null,
  );
  assert.equal(
    resolveWordLearningShortcut({ altKey: false, code: "Digit1" }),
    null,
  );
});

test("recognizes editable keyboard targets", () => {
  assert.equal(isEditableShortcutTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableShortcutTarget({ tagName: "textarea" }), true);
  assert.equal(isEditableShortcutTarget({ tagName: "DIV" }), false);
  assert.equal(isEditableShortcutTarget({ isContentEditable: true }), true);
});
