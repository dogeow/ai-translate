import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMissingCredentialError,
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
