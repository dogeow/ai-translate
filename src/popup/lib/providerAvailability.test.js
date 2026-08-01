import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
  PROVIDER_MINIMAX_GLOBAL,
} from "../../shared/constants.js";
import { DEFAULT_SETTINGS } from "../../shared/settings.js";
import {
  getVerifiedModelOptions,
  getVerifiedProviderOptions,
} from "./providerAvailability.js";

test("popup only lists added providers recorded as verified", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_MINIMAX_GLOBAL,
    addedProviders: [
      PROVIDER_MINIMAX_GLOBAL,
      PROVIDER_CHATGPT,
      PROVIDER_CHROME_AI,
    ],
    verifiedProviders: [
      PROVIDER_CHATGPT,
      PROVIDER_CHROME_AI,
      "unknown-provider",
    ],
  };

  assert.deepEqual(
    getVerifiedProviderOptions(settings).map((option) => option.value),
    [PROVIDER_CHATGPT, PROVIDER_CHROME_AI],
  );
});

test("popup has no selectable providers before a successful add-time test", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_MINIMAX_GLOBAL,
    addedProviders: [PROVIDER_MINIMAX_GLOBAL],
    verifiedProviders: [],
  };

  assert.deepEqual(getVerifiedProviderOptions(settings), []);
});

test("Chrome AI 的运行时自动检测结果优先于旧验证记录", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_CHROME_AI,
    addedProviders: [PROVIDER_CHROME_AI],
    verifiedProviders: [],
  };

  assert.deepEqual(
    getVerifiedProviderOptions(settings, { chromeAiReady: true }).map(
      (option) => option.value,
    ),
    [PROVIDER_CHROME_AI],
  );

  assert.deepEqual(
    getVerifiedProviderOptions(
      {
        ...settings,
        verifiedProviders: [PROVIDER_CHROME_AI],
      },
      { chromeAiReady: false },
    ),
    [],
  );
});

test("模型选项显示服务商与实际模型，并可排除仅翻译模型", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_CHATGPT,
    uiRewriteProvider: PROVIDER_CHATGPT,
    learningProvider: PROVIDER_MINIMAX_GLOBAL,
    addedProviders: [
      PROVIDER_MINIMAX_GLOBAL,
      PROVIDER_CHATGPT,
      PROVIDER_CHROME_AI,
    ],
    verifiedProviders: [
      PROVIDER_MINIMAX_GLOBAL,
      PROVIDER_CHATGPT,
      PROVIDER_CHROME_AI,
    ],
    minimaxModel: "MiniMax-test",
    chatgptModel: "gpt-test",
  };

  assert.deepEqual(
    getVerifiedModelOptions(settings, { includeChromeAi: false }).map(
      (option) => [option.value, option.label],
    ),
    [
      [PROVIDER_MINIMAX_GLOBAL, "MiniMax（海外） · MiniMax-test"],
      [PROVIDER_CHATGPT, "ChatGPT（设备登录） · gpt-test"],
    ],
  );
});
