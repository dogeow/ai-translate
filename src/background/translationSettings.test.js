import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMissingCredentialError,
  PROVIDER_PURPOSE,
  resolvePurposeProviderRuntime,
  resolveProviderRuntime,
} from "./translationSettings.js";

test("a removed final provider cannot continue translating from stale settings", () => {
  const settings = {
    addedProviders: [],
    provider: "ollama",
  };
  const runtime = resolveProviderRuntime(settings);

  assert.equal(runtime.isProviderAdded, false);
  assert.equal(
    buildMissingCredentialError(runtime, settings),
    "请先新增并验证翻译引擎。",
  );
});

test("翻译、页面改造和英语学习解析各自的模型来源", () => {
  const settings = {
    provider: "chrome-ai",
    uiRewriteProvider: "chatgpt",
    learningProvider: "minimax-global",
    addedProviders: ["chrome-ai", "chatgpt", "minimax-global"],
    chatgptModel: "gpt-rewrite",
    minimaxModel: "minimax-learning",
    minimaxApiKeyGlobal: "global-key",
  };

  const translation = resolvePurposeProviderRuntime(
    settings,
    PROVIDER_PURPOSE.TRANSLATION,
  );
  const rewrite = resolvePurposeProviderRuntime(
    settings,
    PROVIDER_PURPOSE.UI_REWRITE,
  );
  const learning = resolvePurposeProviderRuntime(
    settings,
    PROVIDER_PURPOSE.LEARNING,
  );

  assert.equal(translation.provider, "chrome-ai");
  assert.equal(translation.selectedModel, "chrome-translator");
  assert.equal(rewrite.provider, "chatgpt");
  assert.equal(rewrite.selectedModel, "gpt-rewrite");
  assert.equal(learning.provider, "minimax-global");
  assert.equal(learning.selectedModel, "minimax-learning");
  assert.equal(learning.apiKey, "global-key");
  assert.equal(learning.base, "https://api.minimax.io/v1");
});
