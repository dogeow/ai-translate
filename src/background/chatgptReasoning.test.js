import assert from "node:assert/strict";
import test from "node:test";
import { resolveProviderRuntime } from "./translationSettings.js";
import { executeStreamingTranslation } from "./translationExecution.js";
import { translatePageTargetGroup } from "./pageTranslationService.js";
import {
  lookupWordWithConfiguredProvider,
  lookupWordCached,
  clearWordLookupCache,
} from "./wordLookupService.js";
import { generateUiRewriteCss } from "./uiRewriteService.js";
import { runSentenceStudyCompletionText } from "./sentenceStudyStreaming.js";
import {
  getConfig,
  runGenerateRequest,
} from "../options/lib/settings-utils.js";

test("all ChatGPT completion paths send the saved reasoning effort", async (t) => {
  const settings = {
    provider: "chatgpt",
    uiRewriteProvider: "chatgpt",
    learningProvider: "chatgpt",
    wordLookupProvider: "chatgpt",
    addedProviders: ["chatgpt"],
    chatgptModel: "gpt-6-astra",
    chatgptReasoningEffort: "max",
  };
  const runtime = resolveProviderRuntime(settings);
  const local = {
    chatgptCodexAuth: {
      accessToken: "test-token",
      accountId: "test-account",
      expiresAt: Date.now() + 3600000,
    },
  };
  const previousChrome = globalThis.chrome;
  const area = (store) => ({
    get: (_keys, callback) =>
      callback
        ? callback(structuredClone(store))
        : Promise.resolve(structuredClone(store)),
    set: (updates, callback) => {
      Object.assign(store, structuredClone(updates));
      callback?.();
      return Promise.resolve();
    },
  });
  globalThis.chrome = {
    runtime: {},
    storage: { sync: area(settings), local: area(local) },
  };
  t.after(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const requests = [];
  let output = "你好";
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: output })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });

  await executeStreamingTranslation({
    providerRuntime: runtime,
    prompt: "Translate",
    text: "hello",
  });
  output = '["你好"]';
  assert.equal((await translatePageTargetGroup(["hello"], runtime)).ok, true);
  output = "n. 单词";
  assert.deepEqual(
    (await lookupWordWithConfiguredProvider("word", { settings })).translations,
    ["n. 单词"],
  );
  output = "body { color: red; }";
  assert.equal(
    (
      await generateUiRewriteCss({
        url: "https://example.com/",
        prompt: "红色文字",
      })
    ).ok,
    true,
  );
  output = "OK";
  await runGenerateRequest(getConfig(settings), "Test");
  await runSentenceStudyCompletionText(
    runtime.base,
    runtime.selectedModel,
    "Analyze",
    { provider: "chatgpt", reasoningEffort: runtime.reasoningEffort },
  );
  assert.equal(requests.length, 6);
  for (const body of requests)
    assert.deepEqual(body.reasoning, { effort: "max" });

  local.chatgptModelCatalog = [
    {
      name: "account-only-model",
      supportedReasoningEfforts: ["low", "high"],
      defaultReasoningEffort: "low",
    },
  ];
  await runGenerateRequest(
    getConfig({
      ...settings,
      chatgptModel: "account-only-model",
      chatgptReasoningEffort: "high",
    }),
    "Test persisted capabilities",
  );
  assert.deepEqual(requests.at(-1).reasoning, { effort: "high" });
});

test("changing reasoning effort bypasses the word cache", async () => {
  clearWordLookupCache();
  const efforts = [];
  const settings = {
    provider: "chatgpt",
    wordLookupProvider: "chatgpt",
    addedProviders: ["chatgpt"],
    chatgptModel: "gpt-6-astra",
  };
  const lookup = (effort) =>
    lookupWordCached("effort", {
      settings: { ...settings, chatgptReasoningEffort: effort },
      runProviderCompletionImpl: async (payload) => {
        efforts.push(payload.reasoningEffort);
        return "n. 努力";
      },
    });
  await lookup("low");
  await lookup("low");
  await lookup("high");
  assert.deepEqual(efforts, ["low", "high"]);
  clearWordLookupCache();
});
