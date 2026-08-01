import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWordLearningList,
  formatWordLearningDate,
  getWordLearningLevelLabel,
} from "./wordLearningView.js";

test("buildWordLearningList sorts newest first and filters case-insensitively", () => {
  const words = {
    apple: { addedAt: 10 },
    Application: { addedAt: 30 },
    banana: { addedAt: 20 },
  };

  assert.deepEqual(
    buildWordLearningList(words, "APP").map(({ word }) => word),
    ["Application", "apple"],
  );
});

test("buildWordLearningList accepts missing word maps", () => {
  assert.deepEqual(buildWordLearningList(), []);
});

test("getWordLearningLevelLabel formats new and scheduled words", () => {
  assert.equal(getWordLearningLevelLabel({ level: -1 }), "新词");
  assert.equal(getWordLearningLevelLabel({ level: 0 }), "L1 · 1h");
  assert.equal(getWordLearningLevelLabel({ level: 3 }), "L4 · 3d");
});

test("formatWordLearningDate keeps the empty timestamp placeholder", () => {
  assert.equal(formatWordLearningDate(null), "-");
});
