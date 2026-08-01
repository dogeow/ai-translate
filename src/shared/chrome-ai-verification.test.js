import assert from "node:assert/strict";
import test from "node:test";

import { PROVIDER_CHROME_AI, PROVIDER_OLLAMA } from "./constants.js";
import { detectChromeAiRuntimeAvailability } from "./chrome-ai-verification.js";

test("未添加 Chrome AI 时不会执行运行时检测", async () => {
  let calls = 0;
  const result = await detectChromeAiRuntimeAvailability(
    {
      provider: PROVIDER_OLLAMA,
      addedProviders: [PROVIDER_OLLAMA],
    },
    {
      isSupported: () => {
        calls += 1;
        return true;
      },
    },
  );

  assert.equal(result.checked, false);
  assert.equal(result.ready, false);
  assert.equal(calls, 0);
});

test("已下载的 Chrome AI 语言对会被自动判定为可用", async () => {
  const result = await detectChromeAiRuntimeAvailability(
    {
      provider: PROVIDER_CHROME_AI,
      addedProviders: [PROVIDER_CHROME_AI],
      translateTargetLang: "Chinese",
    },
    {
      isSupported: () => true,
      checkAvailability: async (targetLang) => {
        assert.equal(targetLang, "Chinese");
        return {
          supported: true,
          translator: "available",
          sourceCode: "en",
          targetCode: "zh",
        };
      },
    },
  );

  assert.equal(result.checked, true);
  assert.equal(result.ready, true);
});

test("尚未下载的 Chrome AI 语言对不会被标记为可用", async () => {
  const result = await detectChromeAiRuntimeAvailability(
    {
      provider: PROVIDER_CHROME_AI,
      addedProviders: [PROVIDER_CHROME_AI],
    },
    {
      isSupported: () => true,
      checkAvailability: async () => ({
        supported: true,
        translator: "downloadable",
      }),
    },
  );

  assert.equal(result.checked, true);
  assert.equal(result.ready, false);
});
