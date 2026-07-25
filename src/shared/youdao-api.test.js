import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYoudaoAudioUrl,
  isPronounceableEnglishWord,
} from "./youdao-api.js";

test("buildYoudaoAudioUrl uses DogeOW's Youdao accent parameters", () => {
  assert.equal(
    buildYoudaoAudioUrl("hello world", 1),
    "https://dict.youdao.com/dictvoice?audio=hello%20world&type=1",
  );
  assert.equal(
    buildYoudaoAudioUrl("dimensions", 2),
    "https://dict.youdao.com/dictvoice?audio=dimensions&type=2",
  );
});

test("isPronounceableEnglishWord limits the tip button to English words", () => {
  assert.equal(isPronounceableEnglishWord("dimensions"), true);
  assert.equal(isPronounceableEnglishWord("well-known"), true);
  assert.equal(isPronounceableEnglishWord("don't"), true);
  assert.equal(isPronounceableEnglishWord("hello world"), false);
  assert.equal(isPronounceableEnglishWord("尺寸"), false);
});
