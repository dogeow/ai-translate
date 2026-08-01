import assert from "node:assert/strict";
import test from "node:test";

import {
  migrateSettingsIfNeeded,
  getPopupSettingsState,
} from "./settings.js";
import { getMenuSettingsState } from "./utils/contextMenu.js";
import { normalizeRuntimeSettings, resolveProviderRuntime } from "../background/translationSettings.js";
import {
  getSettingsSnapshot,
  getStoredSettingsShape,
  getConfig,
} from "../options/lib/settings-utils.js";

test("legacy 通用设置升级后 popup、菜单、运行时和 options 形状保持一致", async () => {
  let stored = {
    ollamaProvider: "minimax",
    minimaxApiUrl: "https://api.minimax.io/v1",
    minimaxApiKeyGlobal: "global-key",
    minimaxModel: "MiniMax-M2.5-custom",
    ollamaAutoTranslateSelection: true,
    ollamaHoverTranslateScope: "paragraph",
    ollamaHoverTranslateModifierKey: "shift",
    ollamaHoverTranslateDelayMs: "700",
    ollamaPageTranslateConcurrency: "5",
    ollamaPageTranslateBatchChars: "380",
    translateTargetLang: "Japanese",
    appEnabled: false,
  };

  const migration = await migrateSettingsIfNeeded(
    async () => stored,
    async (updates) => {
      stored = { ...stored, ...updates };
    },
  );

  assert.equal(migration.shouldMigrate, true);
  assert.deepEqual(migration.nextSettings, {
    provider: "minimax-global",
    autoTranslateMode: "selection",
    hoverTranslateScope: "paragraph",
    hoverTranslateModifierKey: "shift",
    hoverTranslateDelayMs: 700,
    pageTranslateConcurrency: 5,
    pageTranslateBatchChars: 380,
  });

  const popupState = getPopupSettingsState(migration.settings);
  const menuState = getMenuSettingsState(migration.settings);
  const runtimeSettings = normalizeRuntimeSettings(migration.settings);
  const providerRuntime = resolveProviderRuntime(migration.settings);
  const optionsStoredShape = getStoredSettingsShape(migration.settings);
  const optionsSnapshot = getSettingsSnapshot(optionsStoredShape);
  const optionsConfig = getConfig(optionsStoredShape);

  assert.deepEqual(popupState, {
    provider: "minimax-global",
    autoTranslateMode: "selection",
    hoverTranslateScope: "paragraph",
    hoverTranslateModifierKey: "shift",
    appEnabled: false,
  });
  assert.deepEqual(menuState, popupState);

  assert.equal(runtimeSettings.provider, "minimax-global");
  assert.equal(runtimeSettings.autoTranslateMode, "selection");
  assert.equal(runtimeSettings.hoverTranslateScope, "paragraph");
  assert.equal(runtimeSettings.hoverTranslateModifierKey, "shift");
  assert.equal(runtimeSettings.hoverTranslateDelayMs, 700);
  assert.equal(runtimeSettings.pageTranslateConcurrency, 5);
  assert.equal(runtimeSettings.pageTranslateBatchChars, 380);
  assert.equal(runtimeSettings.appEnabled, false);

  assert.equal(providerRuntime.provider, "minimax-global");
  assert.equal(providerRuntime.isMiniMax, true);
  assert.equal(providerRuntime.base, "https://api.minimax.io/v1");
  assert.equal(providerRuntime.apiKey, "global-key");
  assert.equal(providerRuntime.selectedModel, "MiniMax-M2.5-custom");
  assert.equal(providerRuntime.targetLang, "Japanese");

  assert.equal(optionsStoredShape.provider, "minimax-global");
  assert.equal(optionsStoredShape.autoTranslateMode, "selection");
  assert.equal(optionsStoredShape.hoverTranslateScope, "paragraph");
  assert.equal(optionsStoredShape.hoverTranslateModifierKey, "shift");
  assert.equal(optionsStoredShape.hoverTranslateDelayMs, "700");
  assert.equal(optionsStoredShape.pageTranslateConcurrency, "5");
  assert.equal(optionsStoredShape.pageTranslateBatchChars, "380");

  assert.equal(optionsSnapshot.provider, "minimax-global");
  assert.equal(optionsSnapshot.autoTranslateMode, "selection");
  assert.equal(optionsSnapshot.hoverTranslateScope, "paragraph");
  assert.equal(optionsSnapshot.hoverTranslateModifierKey, "shift");
  assert.equal(optionsSnapshot.hoverTranslateDelayMs, 700);
  assert.equal(optionsSnapshot.pageTranslateConcurrency, 5);
  assert.equal(optionsSnapshot.pageTranslateBatchChars, 380);

  assert.equal(optionsConfig.provider, "minimax-global");
  assert.equal(optionsConfig.base, "https://api.minimax.io/v1");
  assert.equal(optionsConfig.apiKey, "global-key");
  assert.equal(optionsConfig.model, "MiniMax-M2.5-custom");
});
