import assert from "node:assert/strict";
import test from "node:test";

import {
  POPUP_SETTINGS_STORAGE_DEFAULTS,
  buildSettingsMigration,
  getPopupSettingsState,
  migrateSettingsIfNeeded,
  normalizeAllSettings,
} from "./settings.js";

test("getPopupSettingsState 返回 popup 默认状态", () => {
  assert.deepEqual(getPopupSettingsState(), {
    provider: POPUP_SETTINGS_STORAGE_DEFAULTS.provider,
    uiRewriteProvider: POPUP_SETTINGS_STORAGE_DEFAULTS.uiRewriteProvider,
    learningProvider: POPUP_SETTINGS_STORAGE_DEFAULTS.learningProvider,
    wordLookupProvider: POPUP_SETTINGS_STORAGE_DEFAULTS.wordLookupProvider,
    autoTranslateMode: POPUP_SETTINGS_STORAGE_DEFAULTS.autoTranslateMode,
    hoverTranslateScope: POPUP_SETTINGS_STORAGE_DEFAULTS.hoverTranslateScope,
    hoverTranslateModifierKey:
      POPUP_SETTINGS_STORAGE_DEFAULTS.hoverTranslateModifierKey,
    learningModeEnabled: false,
    appEnabled: true,
  });
});

test("getPopupSettingsState 向弹窗提供学习模式开关状态", () => {
  assert.equal(
    getPopupSettingsState({ learningModeEnabled: true }).learningModeEnabled,
    true,
  );
  assert.equal(
    getPopupSettingsState({ learningModeEnabled: false }).learningModeEnabled,
    false,
  );
});

test("migrateSettingsIfNeeded 后 getPopupSettingsState 可读取迁移结果", async () => {
  let stored = {
    ollamaProvider: "minimax",
    minimaxRegion: "global",
    ollamaAutoTranslateSelection: true,
    ollamaHoverTranslateScope: "paragraph",
    appEnabled: false,
  };

  const migration = await migrateSettingsIfNeeded(
    async () => stored,
    async (updates) => {
      stored = { ...stored, ...updates };
    },
  );

  assert.equal(migration.shouldMigrate, true);
  assert.deepEqual(
    getPopupSettingsState(migration.settings),
    {
      provider: "minimax-global",
      uiRewriteProvider: "minimax-global",
      learningProvider: "minimax-global",
      wordLookupProvider: "youdao",
      autoTranslateMode: "selection",
      hoverTranslateScope: "paragraph",
      hoverTranslateModifierKey: "alt",
      learningModeEnabled: false,
      appEnabled: false,
    },
  );
});

test("翻译、改造、学习和单词释义可以保存独立来源", () => {
  const normalized = normalizeAllSettings({
    provider: "chrome-ai",
    uiRewriteProvider: "chatgpt",
    learningProvider: "github-models",
    wordLookupProvider: "chatgpt",
    addedProviders: ["chrome-ai", "chatgpt", "github-models"],
  });

  assert.equal(normalized.provider, "chrome-ai");
  assert.equal(normalized.uiRewriteProvider, "chatgpt");
  assert.equal(normalized.learningProvider, "github-models");
  assert.equal(normalized.wordLookupProvider, "chatgpt");
});

test("旧设置缺少独立用途时沿用当前翻译模型来源", () => {
  const normalized = normalizeAllSettings({
    provider: "chatgpt",
    addedProviders: ["chatgpt"],
  });

  assert.equal(normalized.uiRewriteProvider, "chatgpt");
  assert.equal(normalized.learningProvider, "chatgpt");
  assert.equal(normalized.wordLookupProvider, "youdao");
});

test("单词释义来源无效或已移除时恢复为有道", () => {
  assert.equal(
    normalizeAllSettings({
      provider: "chatgpt",
      wordLookupProvider: "unknown",
      addedProviders: ["chatgpt"],
    }).wordLookupProvider,
    "youdao",
  );
  assert.equal(
    normalizeAllSettings({
      provider: "chatgpt",
      wordLookupProvider: "chrome-ai",
      addedProviders: ["chatgpt"],
    }).wordLookupProvider,
    "youdao",
  );
});

test("normalizeAllSettings 不再直接读取 legacy 通用键", () => {
  const normalized = normalizeAllSettings({
    ollamaProvider: "minimax",
    ollamaAutoTranslateSelection: true,
    ollamaHoverTranslateScope: "paragraph",
    ollamaHoverTranslateModifierKey: "shift",
    ollamaHoverTranslateDelayMs: "640",
  });

  assert.equal(normalized.provider, POPUP_SETTINGS_STORAGE_DEFAULTS.provider);
  assert.equal(
    normalized.autoTranslateMode,
    POPUP_SETTINGS_STORAGE_DEFAULTS.autoTranslateMode,
  );
  assert.equal(
    normalized.hoverTranslateScope,
    POPUP_SETTINGS_STORAGE_DEFAULTS.hoverTranslateScope,
  );
  assert.equal(
    normalized.hoverTranslateModifierKey,
    POPUP_SETTINGS_STORAGE_DEFAULTS.hoverTranslateModifierKey,
  );
});

test("normalizeAllSettings 优先使用 canonical 键而不是 legacy 键", () => {
  const normalized = normalizeAllSettings({
    provider: "github-models",
    ollamaProvider: "minimax",
    autoTranslateMode: "hover",
    ollamaAutoTranslateMode: "selection",
    hoverTranslateScope: "paragraph",
    ollamaHoverTranslateScope: "word",
    hoverTranslateModifierKey: "control",
    ollamaHoverTranslateModifierKey: "shift",
    hoverTranslateDelayMs: "640",
    ollamaHoverTranslateDelayMs: "120",
    pageTranslateConcurrency: "6",
    ollamaPageTranslateConcurrency: "2",
    pageTranslateBatchChars: "512",
    ollamaPageTranslateBatchChars: "96",
  });

  assert.equal(normalized.provider, "github-models");
  assert.equal(normalized.autoTranslateMode, "hover");
  assert.equal(normalized.hoverTranslateScope, "paragraph");
  assert.equal(normalized.hoverTranslateModifierKey, "control");
  assert.equal(normalized.hoverTranslateDelayMs, 640);
  assert.equal(normalized.pageTranslateConcurrency, 6);
  assert.equal(normalized.pageTranslateBatchChars, 512);
});

test("buildSettingsMigration 会把 legacy 键迁移成 canonical 键", () => {
  const migration = buildSettingsMigration({
    ollamaProvider: "minimax",
    minimaxRegion: "global",
    ollamaAutoTranslateSelection: true,
    ollamaHoverTranslateScope: "paragraph",
    ollamaHoverTranslateModifierKey: "shift",
    ollamaHoverTranslateDelayMs: "750",
    ollamaPageTranslateConcurrency: "5",
    ollamaPageTranslateBatchChars: "420",
    appEnabled: false,
  });

  assert.equal(migration.shouldMigrate, true);
  assert.deepEqual(migration.nextSettings, {
    provider: "minimax-global",
    autoTranslateMode: "selection",
    hoverTranslateScope: "paragraph",
    hoverTranslateModifierKey: "shift",
    hoverTranslateDelayMs: 750,
    pageTranslateConcurrency: 5,
    pageTranslateBatchChars: 420,
  });
});

test("buildSettingsMigration 会根据 legacy global API URL 推断 minimax-global", () => {
  const migration = buildSettingsMigration({
    ollamaProvider: "minimax",
    minimaxApiUrl: "https://api.minimax.io/v1",
    minimaxApiKeyGlobal: "global-key",
  });

  assert.equal(migration.shouldMigrate, true);
  assert.deepEqual(migration.nextSettings, {
    provider: "minimax-global",
  });
});

test("buildSettingsMigration 不会因稀疏 legacy 输入写入无关默认值", () => {
  const migration = buildSettingsMigration({
    ollamaProvider: "minimax",
    minimaxRegion: "global",
  });

  assert.equal(migration.shouldMigrate, true);
  assert.deepEqual(migration.nextSettings, {
    provider: "minimax-global",
  });
});

test("buildSettingsMigration 在 canonical 键已存在时不覆盖新值", () => {
  const migration = buildSettingsMigration({
    provider: "github-models",
    ollamaProvider: "minimax",
    autoTranslateMode: "hover",
    ollamaAutoTranslateMode: "selection",
    hoverTranslateScope: "paragraph",
    hoverTranslateModifierKey: "meta",
    hoverTranslateDelayMs: 640,
    pageTranslateConcurrency: 4,
    pageTranslateBatchChars: 320,
  });

  assert.equal(migration.shouldMigrate, false);
  assert.deepEqual(migration.nextSettings, {});
});

test("buildSettingsMigration 会使用 legacy 值修复无效 canonical 值", () => {
  const migration = buildSettingsMigration({
    provider: "",
    ollamaProvider: "minimax",
    minimaxRegion: "global",
    autoTranslateMode: "",
    ollamaAutoTranslateMode: "hover",
  });

  assert.equal(migration.shouldMigrate, true);
  assert.deepEqual(migration.nextSettings, {
    provider: "minimax-global",
    autoTranslateMode: "hover",
  });
});

test("migrateSettingsIfNeeded 在写入失败时仍返回迁移后的 settings", async () => {
  const stored = {
    ollamaProvider: "minimax",
    minimaxRegion: "global",
  };

  const migration = await migrateSettingsIfNeeded(
    async () => stored,
    async () => {
      throw new Error("write failed");
    },
  );

  assert.equal(migration.shouldMigrate, true);
  assert.equal(migration.writeFailed, true);
  assert.equal(migration.error?.message, "write failed");
  assert.equal(migration.settings.provider, "minimax-global");
});
