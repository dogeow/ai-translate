import assert from "node:assert/strict";
import test from "node:test";

import {
  isLearningModeSupported,
  resolveLearningProvider,
} from "./learningSettings.js";

test("learning mode follows its independent provider", () => {
  const settings = {
    provider: "chrome-ai",
    learningProvider: "chatgpt",
    addedProviders: ["chrome-ai", "chatgpt"],
  };

  assert.equal(resolveLearningProvider(settings), "chatgpt");
  assert.equal(isLearningModeSupported(settings), true);
});

test("Chrome AI disables learning only when selected for learning", () => {
  const settings = {
    provider: "chatgpt",
    learningProvider: "chrome-ai",
    addedProviders: ["chatgpt", "chrome-ai"],
  };

  assert.equal(isLearningModeSupported(settings), false);
});

test("legacy settings fall back to the translation provider", () => {
  assert.equal(
    resolveLearningProvider({
      provider: "github-models",
      addedProviders: ["github-models"],
    }),
    "github-models",
  );
});
