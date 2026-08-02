import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiWordDefinitionPrompt,
  formatWordTranslations,
  isUsableYoudaoWordResult,
  parseAiWordTranslations,
  resolveWordLookupAiProvider,
} from "./word-lookup.js";

test("有道结果必须与请求单词一致且包含释义", () => {
  assert.equal(
    isUsableYoudaoWordResult("cultural", {
      responseWord: "cultural",
      translations: ["adj. 文化的"],
    }),
    true,
  );
  assert.equal(
    isUsableYoudaoWordResult("cultural", {
      responseWord: "preschooler",
      translations: ["n. 学龄前儿童"],
    }),
    false,
  );
  assert.equal(
    isUsableYoudaoWordResult("cultural", {
      responseWord: "cultural",
      translations: [],
    }),
    false,
  );
});

test("AI 单词提示与响应保持简洁多行释义", () => {
  assert.match(buildAiWordDefinitionPrompt("cultural"), /最多 5 行/);
  assert.deepEqual(
    parseAiWordTranslations("- adj. 文化的\n2. adj. 文艺的\n```"),
    ["adj. 文化的", "adj. 文艺的"],
  );
  assert.equal(
    formatWordTranslations(["adj. 文化的", "adj. 文艺的"]),
    "adj. 文化的\nadj. 文艺的",
  );
});

test("有道模式使用学习模型回退，AI 模式直接使用所选模型", () => {
  assert.equal(
    resolveWordLookupAiProvider({
      wordLookupProvider: "youdao",
      learningProvider: "chatgpt",
    }),
    "chatgpt",
  );
  assert.equal(
    resolveWordLookupAiProvider({
      wordLookupProvider: "chrome-ai",
      learningProvider: "chatgpt",
    }),
    "chrome-ai",
  );
});
