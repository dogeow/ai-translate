import assert from "node:assert/strict";
import test from "node:test";

import { WORD_LEARNING_STATUS } from "./tip/wordLearningActions.js";
import { resolveWordMarkerCardShortcut } from "./wordMarkerShortcuts.js";

test("词典卡片将 Option+1 和 Option+2 映射到当前单词", () => {
  assert.deepEqual(
    resolveWordMarkerCardShortcut(
      { altKey: true, code: "Digit1" },
      "sign",
    ),
    { word: "sign", status: WORD_LEARNING_STATUS.STUDYING },
  );
  assert.deepEqual(
    resolveWordMarkerCardShortcut(
      { altKey: true, code: "Digit2" },
      "sign",
    ),
    { word: "sign", status: WORD_LEARNING_STATUS.KNOWN },
  );
});

test("没有打开卡片或正在输入时不处理单词快捷键", () => {
  assert.equal(
    resolveWordMarkerCardShortcut(
      { altKey: true, code: "Digit1" },
      "",
    ),
    null,
  );
  assert.equal(
    resolveWordMarkerCardShortcut(
      {
        altKey: true,
        code: "Digit1",
        target: { tagName: "INPUT" },
      },
      "sign",
    ),
    null,
  );
});
