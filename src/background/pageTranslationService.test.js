import assert from "node:assert/strict";
import test from "node:test";

import {
  executePageTranslationGroups,
  groupPageTextsByTargetLang,
  translatePageTargetGroup,
} from "./pageTranslationService.js";

test("mixed Chinese and English page texts are grouped by effective target", () => {
  const groups = groupPageTextsByTargetLang(
    ["Hello", "你好", "World", "再见"],
    "Chinese",
  );

  assert.deepEqual(groups, [
    {
      targetLang: "Chinese",
      items: [
        { index: 0, text: "Hello" },
        { index: 2, text: "World" },
      ],
    },
    {
      targetLang: "English",
      items: [
        { index: 1, text: "你好" },
        { index: 3, text: "再见" },
      ],
    },
  ]);
});

test("group results are restored to their original page order", async () => {
  const groups = groupPageTextsByTargetLang(
    ["Hello", "你好", "World", "再见"],
    "Chinese",
  );

  const result = await executePageTranslationGroups(
    groups,
    async (texts, targetLang) => ({
      ok: true,
      translations: texts.map((text) => `${targetLang}:${text}`),
    }),
  );

  assert.deepEqual(result, {
    ok: true,
    translations: [
      "Chinese:Hello",
      "English:你好",
      "Chinese:World",
      "English:再见",
    ],
  });
});

test("a failed target group does not expose partial translations", async () => {
  const groups = groupPageTextsByTargetLang(["Hello", "你好"], "Chinese");
  let callCount = 0;

  const result = await executePageTranslationGroups(groups, async (texts) => {
    callCount += 1;
    if (callCount === 1) {
      return { ok: true, translations: texts.map(() => "第一组结果") };
    }
    return {
      ok: false,
      rateLimited: true,
      error: "429 rate limit",
      translations: ["不应返回"],
    };
  });

  assert.equal(callCount, 2);
  assert.deepEqual(result, {
    ok: false,
    rateLimited: true,
    error: "429 rate limit",
  });
  assert.equal("translations" in result, false);
});

test("Chrome AI translates every item with the group's target language", async () => {
  const calls = [];
  const providerRuntime = {
    isChromeAi: true,
    targetLang: "English",
  };

  const result = await translatePageTargetGroup(
    ["你好", "再见"],
    providerRuntime,
    {},
    {
      generateChromeAiCompletion: async (text, targetLang) => {
        calls.push({ text, targetLang });
        return `${text}-en`;
      },
    },
  );

  assert.deepEqual(calls, [
    { text: "你好", targetLang: "English" },
    { text: "再见", targetLang: "English" },
  ]);
  assert.deepEqual(result, {
    ok: true,
    translations: ["你好-en", "再见-en"],
  });
});

test("non-Chrome providers use one batch request for a target group", async () => {
  let payload = null;
  const providerRuntime = {
    isChromeAi: false,
    provider: "ollama",
    base: "http://127.0.0.1:11434",
    selectedModel: "test-model",
    apiKey: "",
    targetLang: "Chinese",
  };

  const result = await translatePageTargetGroup(
    ["Hello", "World"],
    providerRuntime,
    {},
    {
      runProviderCompletion: async (nextPayload) => {
        payload = nextPayload;
        return '["你好","世界"]';
      },
    },
  );

  assert.equal(payload.targetLang, "Chinese");
  assert.equal(payload.text, "Hello\nWorld");
  assert.match(payload.prompt, /to Chinese/u);
  assert.deepEqual(result, {
    ok: true,
    translations: ["你好", "世界"],
  });
});
