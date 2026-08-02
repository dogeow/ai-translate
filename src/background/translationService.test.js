import assert from "node:assert/strict";
import test from "node:test";

import { shouldUseConfiguredWordLookup } from "./translationService.js";

test("普通单词翻译统一进入单词释义来源", () => {
  assert.equal(shouldUseConfiguredWordLookup("federation", "hover"), true);
  assert.equal(shouldUseConfiguredWordLookup("cultural", undefined), true);
});

test("整段、中文和页面翻译不进入单词查词", () => {
  assert.equal(shouldUseConfiguredWordLookup("the federation", "hover"), false);
  assert.equal(shouldUseConfiguredWordLookup("文化", "hover"), false);
  assert.equal(
    shouldUseConfiguredWordLookup("federation", "page-visual"),
    false,
  );
  assert.equal(
    shouldUseConfiguredWordLookup("federation", "hover", {
      useWordLookup: false,
    }),
    false,
  );
});
