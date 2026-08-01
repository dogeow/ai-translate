import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MINIMAX_API_URL_CN,
  DEFAULT_MINIMAX_API_URL_GLOBAL,
  MINIMAX_REGION_CN,
  MINIMAX_REGION_GLOBAL,
  PROVIDER_CHROME_AI,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_OLLAMA,
} from "../../../shared/constants.js";
import { DEFAULT_SETTINGS } from "../../../shared/settings.js";
import {
  buildActivatedProviderSettings,
  buildRemovedProviderSettings,
  buildSavedProviderSettings,
  getAddedProviders,
  getAvailableProviders,
  getProviderCardMeta,
} from "./providerUi.js";

test("provider cards keep the active provider and remove duplicates", () => {
  const settings = {
    provider: PROVIDER_CHROME_AI,
    addedProviders: [
      PROVIDER_OLLAMA,
      PROVIDER_OLLAMA,
      "unknown-provider",
    ],
  };

  assert.deepEqual(getAddedProviders(settings), [
    PROVIDER_CHROME_AI,
    PROVIDER_OLLAMA,
  ]);
});

test("add-provider choices exclude existing cards", () => {
  const available = getAvailableProviders({
    provider: PROVIDER_OLLAMA,
    addedProviders: [PROVIDER_OLLAMA, PROVIDER_CHROME_AI],
  });

  assert.equal(
    available.some((option) => option.value === PROVIDER_OLLAMA),
    false,
  );
  assert.equal(
    available.some((option) => option.value === PROVIDER_CHROME_AI),
    false,
  );
});

test("switching a card activates it and keeps it in the added list", () => {
  const next = buildActivatedProviderSettings(
    {
      provider: PROVIDER_OLLAMA,
      addedProviders: [PROVIDER_OLLAMA],
    },
    PROVIDER_MINIMAX_GLOBAL,
  );

  assert.equal(next.provider, PROVIDER_MINIMAX_GLOBAL);
  assert.deepEqual(next.addedProviders, [
    PROVIDER_OLLAMA,
    PROVIDER_MINIMAX_GLOBAL,
  ]);
  assert.equal(next.minimaxRegion, "global");
  assert.equal(next.minimaxApiUrl, "https://api.minimax.io/v1");
});

test("removing the first active provider switches to a verified remaining provider", () => {
  const next = buildRemovedProviderSettings(
    {
      provider: PROVIDER_OLLAMA,
      addedProviders: [
        PROVIDER_OLLAMA,
        PROVIDER_MINIMAX_GLOBAL,
        PROVIDER_CHROME_AI,
      ],
      verifiedProviders: [
        PROVIDER_OLLAMA,
        PROVIDER_CHROME_AI,
      ],
    },
    PROVIDER_OLLAMA,
  );

  assert.equal(next.provider, PROVIDER_CHROME_AI);
  assert.deepEqual(next.addedProviders, [
    PROVIDER_MINIMAX_GLOBAL,
    PROVIDER_CHROME_AI,
  ]);
  assert.deepEqual(next.verifiedProviders, [PROVIDER_CHROME_AI]);
});

test("removing the last provider leaves an empty provider list", () => {
  const next = buildRemovedProviderSettings(
    {
      provider: PROVIDER_OLLAMA,
      addedProviders: [PROVIDER_OLLAMA],
      verifiedProviders: [PROVIDER_OLLAMA],
    },
    PROVIDER_OLLAMA,
  );

  assert.deepEqual(next.addedProviders, []);
  assert.deepEqual(next.verifiedProviders, []);
});

test("editing an inactive MiniMax card keeps the active MiniMax route", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_MINIMAX_CN,
    addedProviders: [PROVIDER_MINIMAX_CN, PROVIDER_MINIMAX_GLOBAL],
    minimaxRegion: MINIMAX_REGION_CN,
    minimaxApiUrl: DEFAULT_MINIMAX_API_URL_CN,
  };
  const draft = {
    ...settings,
    provider: PROVIDER_MINIMAX_GLOBAL,
    minimaxRegion: MINIMAX_REGION_GLOBAL,
    minimaxApiUrl: DEFAULT_MINIMAX_API_URL_GLOBAL,
    minimaxApiKeyGlobal: "global-key",
  };

  const next = buildSavedProviderSettings(settings, draft, false);

  assert.equal(next.provider, PROVIDER_MINIMAX_CN);
  assert.equal(next.minimaxRegion, MINIMAX_REGION_CN);
  assert.equal(next.minimaxApiUrl, DEFAULT_MINIMAX_API_URL_CN);
  assert.equal(next.minimaxApiKeyGlobal, "global-key");
});

test("a provider is recorded as verified after its add-time test succeeds", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_OLLAMA,
    addedProviders: [PROVIDER_OLLAMA],
    verifiedProviders: [],
  };
  const draft = {
    ...settings,
    provider: PROVIDER_MINIMAX_GLOBAL,
    minimaxApiKeyGlobal: "global-key",
  };

  const next = buildSavedProviderSettings(settings, draft, true, true);

  assert.deepEqual(next.verifiedProviders, [PROVIDER_MINIMAX_GLOBAL]);
});

test("changing a verified provider configuration invalidates its status", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_OLLAMA,
    addedProviders: [PROVIDER_OLLAMA],
    verifiedProviders: [PROVIDER_OLLAMA],
    ollamaModel: "qwen2.5:7b",
  };
  const draft = {
    ...settings,
    ollamaModel: "qwen3:8b",
  };

  const next = buildSavedProviderSettings(settings, draft, false, false);

  assert.deepEqual(next.verifiedProviders, []);
});

test("a failed re-test invalidates an existing verified status", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_OLLAMA,
    addedProviders: [PROVIDER_OLLAMA],
    verifiedProviders: [PROVIDER_OLLAMA],
    ollamaModel: "qwen2.5:7b",
  };

  const next = buildSavedProviderSettings(
    settings,
    settings,
    false,
    false,
    true,
  );

  assert.deepEqual(next.verifiedProviders, []);
});

test("Chrome AI 卡片优先显示当前设备的自动检测结果", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    provider: PROVIDER_CHROME_AI,
    addedProviders: [PROVIDER_CHROME_AI],
    verifiedProviders: [],
  };

  assert.deepEqual(
    getProviderCardMeta(
      PROVIDER_CHROME_AI,
      settings,
      false,
      "ready",
    ),
    {
      detail: "浏览器内置模型",
      status: "已就绪",
      ready: true,
    },
  );

  assert.equal(
    getProviderCardMeta(
      PROVIDER_CHROME_AI,
      {
        ...settings,
        verifiedProviders: [PROVIDER_CHROME_AI],
      },
      false,
      "unavailable",
    ).ready,
    false,
  );
});
