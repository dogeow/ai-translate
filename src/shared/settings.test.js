import assert from "node:assert/strict";
import test from "node:test";

import {
  POPUP_SETTINGS_STORAGE_DEFAULTS,
  getPopupSettingsState,
} from "./settings.js";

test("getPopupSettingsState 返回 popup 默认状态", () => {
  assert.deepEqual(getPopupSettingsState(), {
    provider: POPUP_SETTINGS_STORAGE_DEFAULTS.ollamaProvider,
    autoTranslateMode: POPUP_SETTINGS_STORAGE_DEFAULTS.ollamaAutoTranslateMode,
    hoverTranslateScope:
      POPUP_SETTINGS_STORAGE_DEFAULTS.ollamaHoverTranslateScope,
    appEnabled: true,
  });
});

test("getPopupSettingsState 会归一化 legacy provider 和 selection 兼容字段", () => {
  assert.deepEqual(
    getPopupSettingsState({
      ollamaProvider: "minimax",
      minimaxRegion: "global",
      ollamaAutoTranslateSelection: true,
      ollamaHoverTranslateScope: "paragraph",
      appEnabled: false,
    }),
    {
      provider: "minimax-global",
    autoTranslateMode: "selection",
      hoverTranslateScope: "paragraph",
      appEnabled: false,
    },
  );
});