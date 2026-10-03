import assert from "node:assert/strict";
import test from "node:test";
import {
  getChatGptReasoningInfo,
  parseChatGptReasoningInfo,
  resolveChatGptReasoningEffort,
} from "./chatgpt-reasoning.js";
import {
  buildChatGptCodexRequestBody,
  fetchChatGptModelCatalog,
  fetchChatGptModels,
  parseChatGptModelCatalog,
} from "./chatgpt-codex-api.js";
import {
  getConfig,
  getSettingsSnapshot,
  getStoredSettingsShape,
} from "../options/lib/settings-utils.js";

test("Astra and Spark expose different supported reasoning levels", () => {
  assert.equal(resolveChatGptReasoningEffort("gpt-6-astra", "max"), "max");
  assert.equal(resolveChatGptReasoningEffort("gpt-5.3-codex-spark", "max"), "");
  assert.equal(
    resolveChatGptReasoningEffort("gpt-5.3-codex-spark", "xhigh"),
    "xhigh",
  );
  assert.equal(
    getChatGptReasoningInfo("gpt-5.3-codex-spark").defaultReasoningEffort,
    "high",
  );
});

test("the account catalog overrides fallbacks and retains explicit no-reasoning support", () => {
  const [model] = parseChatGptModelCatalog({
    models: [
      {
        slug: "gpt-6-astra",
        visibility: "list",
        supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
        default_reasoning_level: "low",
      },
    ],
  });
  assert.deepEqual(
    getChatGptReasoningInfo(model.name, model).supportedReasoningEfforts,
    ["low", "high"],
  );
  assert.equal(resolveChatGptReasoningEffort(model.name, "max", model), "");
  assert.deepEqual(
    getChatGptReasoningInfo(model.name, {
      name: model.name,
      supportedReasoningEfforts: [],
    }).supportedReasoningEfforts,
    [],
  );
});

test("unknown models use only advertised capabilities, without guessing levels", () => {
  assert.equal(resolveChatGptReasoningEffort("future-model", "high"), "");
  const info = {
    name: "future-model",
    ...parseChatGptReasoningInfo({
      supported_reasoning_levels: ["low", "high", "high"],
      default_reasoning_level: "high",
    }),
  };
  assert.equal(
    resolveChatGptReasoningEffort("future-model", "high", info),
    "high",
  );
  assert.equal(
    resolveChatGptReasoningEffort("different-model", "high", info),
    "",
  );
});

test("automatic, unsupported and Ultra efforts are never sent as reasoning parameters", () => {
  for (const effort of ["", "auto", "ultra", "invalid"]) {
    assert.equal(
      buildChatGptCodexRequestBody("gpt-6-astra", "test", {
        reasoningEffort: effort,
      }).reasoning,
      undefined,
    );
  }
  assert.equal(
    buildChatGptCodexRequestBody("gpt-5.3-codex-spark", "test", {
      reasoningEffort: "max",
    }).reasoning,
    undefined,
  );
  assert.deepEqual(
    buildChatGptCodexRequestBody("gpt-6-astra", "test", {
      reasoningEffort: "max",
    }).reasoning,
    { effort: "max" },
  );
  assert.deepEqual(
    buildChatGptCodexRequestBody("gpt-5.3-codex-spark", "test", {
      reasoningEffort: "xhigh",
    }).reasoning,
    { effort: "xhigh" },
  );
});

test("reasoning effort survives settings save, reload and runtime configuration", () => {
  const saved = getSettingsSnapshot({
    provider: "chatgpt",
    chatgptModel: "gpt-6-astra",
    chatgptReasoningEffort: " max ",
  });
  const loaded = getStoredSettingsShape(saved);
  assert.equal(loaded.chatgptReasoningEffort, "max");
  assert.equal(getConfig(loaded).reasoningEffort, "max");
  assert.equal(getStoredSettingsShape({}).chatgptReasoningEffort, "");
});

test("model discovery and its cache retain reasoning metadata without breaking name-only callers", async () => {
  let requests = 0;
  const options = {
    auth: { accessToken: "test-token", accountId: "reasoning-catalog-test" },
    fetchImpl: async () => {
      requests++;
      return Response.json({
        models: [
          {
            slug: "gpt-6-astra",
            supported_reasoning_levels: [
              { effort: "low" },
              { effort: "max" },
              { effort: "ultra" },
            ],
            default_reasoning_level: "low",
          },
        ],
      });
    },
  };
  const catalog = await fetchChatGptModelCatalog({
    ...options,
    forceRefresh: true,
  });
  assert.deepEqual(catalog[0].supportedReasoningEfforts, ["low", "max"]);
  assert.equal(catalog[0].supportsUltra, true);
  catalog[0].supportedReasoningEfforts.push("corrupted");
  const cached = await fetchChatGptModelCatalog(options);
  assert.deepEqual(cached[0].supportedReasoningEfforts, ["low", "max"]);
  assert.deepEqual(await fetchChatGptModels(options), ["gpt-6-astra"]);
  assert.equal(requests, 1);
});
