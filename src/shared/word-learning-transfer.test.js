import assert from "node:assert/strict";
import test from "node:test";

import {
  WORD_LEARNING_EXPORT_FORMAT,
  buildWordLearningExport,
  mergeWordLearningData,
  parseWordLearningImport,
} from "./word-learning-transfer.js";

const STUDY_ENTRY = {
  addedAt: 10,
  level: 2,
  lastReviewedAt: 20,
  nextReviewAt: 30,
  lastAction: "remember",
  history: [{ at: 20, action: "remember" }],
};

test("exports all categories and preserves review progress", () => {
  const exported = buildWordLearningExport(
    {
      known: { zebra: { addedAt: 2 } },
      studying: { apple: STUDY_ENTRY },
    },
    "all",
    Date.UTC(2026, 7, 2),
  );

  assert.equal(exported.format, WORD_LEARNING_EXPORT_FORMAT);
  assert.equal(exported.scope, "all");
  assert.deepEqual(exported.known, [{ word: "zebra", addedAt: 2 }]);
  assert.deepEqual(exported.studying, [{ word: "apple", ...STUDY_ENTRY }]);
});

test("exports one selected category", () => {
  const studyingOnly = buildWordLearningExport(
    {
      known: { known: { addedAt: 1 } },
      studying: { study: STUDY_ENTRY },
    },
    "studying",
    1,
  );

  assert.equal(studyingOnly.known.length, 0);
  assert.equal(studyingOnly.studying[0].word, "study");
});

test("round-trips an exported JSON file", () => {
  const exported = buildWordLearningExport(
    {
      known: { known: { addedAt: 1 } },
      studying: { study: STUDY_ENTRY },
    },
    "all",
    Date.UTC(2026, 7, 2),
  );
  const imported = parseWordLearningImport(JSON.stringify(exported), 100);

  assert.deepEqual(imported.known.known, { addedAt: 1 });
  assert.deepEqual(imported.studying.study, STUDY_ENTRY);
});

test("imports simple word lists into studying", () => {
  const imported = parseWordLearningImport("apple\nbanana\ninvalid word", 100);

  assert.deepEqual(Object.keys(imported.studying), ["apple", "banana"]);
  assert.equal(imported.skipped, 1);
});

test("keeps existing local status and progress while merging", () => {
  const result = mergeWordLearningData(
    {
      known: { local: { addedAt: 1 } },
      studying: { apple: STUDY_ENTRY },
    },
    parseWordLearningImport(
      {
        known: ["apple", "newknown"],
        studying: ["local", "newstudy"],
      },
      100,
    ),
  );

  assert.deepEqual(result.studying.apple, STUDY_ENTRY);
  assert.deepEqual(result.known.local, { addedAt: 1 });
  assert.ok(result.known.newknown);
  assert.ok(result.studying.newstudy);
  assert.equal(result.addedKnown, 1);
  assert.equal(result.addedStudying, 1);
  assert.equal(result.skipped, 2);
});

test("known wins when the same word appears in both imported categories", () => {
  const imported = parseWordLearningImport(
    { studying: ["shared"], known: ["shared"] },
    100,
  );

  assert.equal(imported.studying.shared, undefined);
  assert.deepEqual(imported.known.shared, { addedAt: 100 });
  assert.equal(imported.skipped, 1);
});
