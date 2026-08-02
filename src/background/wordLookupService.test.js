import assert from "node:assert/strict";
import test from "node:test";

import {
  clearWordLookupCache,
  lookupWordCached,
  lookupWordWithConfiguredProvider,
} from "./wordLookupService.js";

const BASE_SETTINGS = {
  provider: "chatgpt",
  learningProvider: "chatgpt",
  wordLookupProvider: "youdao",
  addedProviders: ["chatgpt", "chrome-ai"],
  verifiedProviders: ["chatgpt", "chrome-ai"],
  chatgptModel: "gpt-test",
};

test("有道匹配时直接返回，不调用 AI", async () => {
  let aiCalls = 0;
  const result = await lookupWordWithConfiguredProvider("federation", {
    settings: BASE_SETTINGS,
    lookupYoudaoImpl: async () => ({
      word: "federation",
      responseWord: "federation",
      ukphone: "fedə'reɪʃ(ə)n",
      usphone: "fedə'reɪʃ(ə)n",
      translations: ["n. 联邦；联合会"],
    }),
    runProviderCompletionImpl: async () => {
      aiCalls += 1;
      return "不应调用";
    },
  });

  assert.equal(result.provider, "youdao");
  assert.equal(result.model, "有道词典");
  assert.equal(aiCalls, 0);
});

test("有道返回错误词条时自动使用学习模型", async () => {
  const result = await lookupWordWithConfiguredProvider("cultural", {
    settings: BASE_SETTINGS,
    lookupYoudaoImpl: async () => ({
      word: "cultural",
      responseWord: "preschooler",
      translations: ["n. 学龄前儿童"],
    }),
    runProviderCompletionImpl: async ({ provider, model }) => {
      assert.equal(provider, "chatgpt");
      assert.equal(model, "gpt-test");
      return "adj. 文化的；与文化有关的\nadj. 艺术的；文艺的";
    },
  });

  assert.equal(result.provider, "chatgpt");
  assert.equal(result.fallback, true);
  assert.deepEqual(result.translations, [
    "adj. 文化的；与文化有关的",
    "adj. 艺术的；文艺的",
  ]);
});

test("选择 AI 单词模型时跳过有道", async () => {
  let youdaoCalls = 0;
  const result = await lookupWordWithConfiguredProvider("federation", {
    settings: {
      ...BASE_SETTINGS,
      wordLookupProvider: "chrome-ai",
    },
    lookupYoudaoImpl: async () => {
      youdaoCalls += 1;
      return null;
    },
    runProviderCompletionImpl: async ({ provider, text, targetLang }) => {
      assert.equal(provider, "chrome-ai");
      assert.equal(text, "federation");
      assert.equal(targetLang, "Chinese");
      return "联邦；联合会";
    },
  });

  assert.equal(result.provider, "chrome-ai");
  assert.equal(youdaoCalls, 0);
});

test("空结果与失败结果不会写入 24 小时缓存", async () => {
  clearWordLookupCache();
  let youdaoCalls = 0;
  const options = {
    settings: {
      ...BASE_SETTINGS,
      learningProvider: "ollama",
      addedProviders: ["ollama"],
      ollamaModel: "",
    },
    lookupYoudaoImpl: async () => {
      youdaoCalls += 1;
      return {
        word: "cultural",
        responseWord: "cultural",
        translations: [],
      };
    },
  };

  assert.equal((await lookupWordCached("cultural", options)).ok, false);
  assert.equal((await lookupWordCached("cultural", options)).ok, false);
  assert.equal(youdaoCalls, 2);
});
