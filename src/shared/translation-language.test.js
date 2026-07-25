import assert from "node:assert/strict";
import test from "node:test";

import {
  isChineseIdentifierText,
  isLikelyChineseText,
  resolveTranslationTargetLang,
} from "./translation-language.js";

test("Chinese text uses English as the secondary translation language", () => {
  assert.equal(
    resolveTranslationTargetLang("这个程序更好一点。", "Chinese"),
    "English",
  );
});

test("non-Chinese text keeps the configured target language", () => {
  assert.equal(resolveTranslationTargetLang("dimensions", "Chinese"), "Chinese");
  assert.equal(resolveTranslationTargetLang("Bonjour", "German"), "German");
});

test("Japanese kana is not mistaken for Chinese", () => {
  assert.equal(isLikelyChineseText("これは日本語です"), false);
  assert.equal(
    resolveTranslationTargetLang("これは日本語です", "Chinese"),
    "Chinese",
  );
});

test("Chinese identifiers with a high digit ratio are skipped separately", () => {
  assert.equal(isChineseIdentifierText("版本2026"), true);
  assert.equal(isChineseIdentifierText("第2章"), false);
  assert.equal(isChineseIdentifierText("2026"), false);
  assert.equal(isChineseIdentifierText("中文内容"), false);
});

test("short Han-only text is treated as Chinese", () => {
  assert.equal(isLikelyChineseText("尺寸"), true);
});

test("empty text keeps the configured target language", () => {
  assert.equal(resolveTranslationTargetLang("", "Chinese"), "Chinese");
});
