import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SETTING_SHORTCUT_COMMANDS,
  isSettingShortcutCommand,
  resolveSettingShortcut,
} from "./shortcutSettings.js";

const manifest = JSON.parse(
  readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
);

test("manifest exposes every mode-setting shortcut", () => {
  for (const command of SETTING_SHORTCUT_COMMANDS) {
    assert.ok(manifest.commands?.[command], `${command} must be declared`);
    assert.equal(isSettingShortcutCommand(command), true);
  }
  assert.equal(isSettingShortcutCommand("translate-selection"), false);
});

test("auto translation shortcut cycles through all trigger modes", () => {
  assert.deepEqual(
    resolveSettingShortcut("cycle-auto-translate-mode", {
      autoTranslateMode: "hotkey",
    }),
    {
      updates: { autoTranslateMode: "selection" },
      message: "取词模式：双击 / 三击后翻译",
    },
  );
  assert.deepEqual(
    resolveSettingShortcut("cycle-auto-translate-mode", {
      autoTranslateMode: "selection",
    }).updates,
    { autoTranslateMode: "hover" },
  );
  assert.deepEqual(
    resolveSettingShortcut("cycle-auto-translate-mode", {
      autoTranslateMode: "hover",
    }).updates,
    { autoTranslateMode: "hotkey" },
  );
});

test("hover scope shortcut alternates between word and paragraph", () => {
  assert.deepEqual(
    resolveSettingShortcut("toggle-hover-translate-scope", {
      hoverTranslateScope: "word",
    }),
    {
      updates: { hoverTranslateScope: "paragraph" },
      message: "悬停翻译范围：翻译整段话",
    },
  );
});

test("learning and word modes use their persisted boolean state", () => {
  assert.deepEqual(
    resolveSettingShortcut("toggle-learning-mode", {
      learningModeEnabled: false,
      provider: "ollama",
    }).updates,
    { learningModeEnabled: true },
  );
  assert.deepEqual(
    resolveSettingShortcut("toggle-word-marking", {
      wordMarkingEnabled: true,
    }).updates,
    { wordMarkingEnabled: false },
  );
  assert.deepEqual(
    resolveSettingShortcut("toggle-word-recognition-mode", {}),
    {
      updates: { wordRecognitionModeEnabled: true },
      message: "认词模式已开启",
    },
  );
});

test("Chrome AI cannot enable unsupported learning mode", () => {
  assert.deepEqual(
    resolveSettingShortcut("toggle-learning-mode", {
      learningModeEnabled: false,
      provider: "chrome-ai",
    }),
    {
      updates: null,
      message: "Chrome 内置 AI 不支持学习模式",
    },
  );
});
