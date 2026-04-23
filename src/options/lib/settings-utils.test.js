import assert from "node:assert/strict";
import test from "node:test";

import {
  getSettingsSnapshot,
  getStoredSettingsShape,
} from "./settings-utils.js";

test("getSettingsSnapshot 为无协议 Ollama 地址补上 http", () => {
  const snapshot = getSettingsSnapshot({
    ollamaUrl: "127.0.0.1:11434",
  });

  assert.equal(snapshot.ollamaUrl, "http://127.0.0.1:11434");
});

test("getStoredSettingsShape 为无协议 Ollama 地址补上 http", () => {
  const stored = getStoredSettingsShape({
    ollamaUrl: "localhost:11434",
  });

  assert.equal(stored.ollamaUrl, "http://localhost:11434");
});

test("getSettingsSnapshot 在保存时会 trim 自定义模型名", () => {
  const snapshot = getSettingsSnapshot({
    ollamaModel: "  custom ollama model  ",
    minimaxModel: "  custom minimax model  ",
    githubModel: "  custom github model  ",
  });

  assert.equal(snapshot.ollamaModel, "custom ollama model");
  assert.equal(snapshot.minimaxModel, "custom minimax model");
  assert.equal(snapshot.githubModel, "custom github model");
});

test("getStoredSettingsShape 在加载时会 trim 自定义模型名", () => {
  const stored = getStoredSettingsShape({
    ollamaModel: "  local model  ",
    minimaxModel: "  remote minimax model  ",
    githubModel: "  remote github model  ",
  });

  assert.equal(stored.ollamaModel, "local model");
  assert.equal(stored.minimaxModel, "remote minimax model");
  assert.equal(stored.githubModel, "remote github model");
});

test("getSettingsSnapshot 会输出 canonical 通用设置键", () => {
  const snapshot = getSettingsSnapshot({
    provider: "github-models",
    autoTranslateMode: "hover",
    hoverTranslateScope: "paragraph",
    hoverTranslateDelayMs: "650",
    pageTranslateConcurrency: "6",
    pageTranslateBatchChars: "420",
  });

  assert.equal(snapshot.provider, "github-models");
  assert.equal(snapshot.autoTranslateMode, "hover");
  assert.equal(snapshot.hoverTranslateScope, "paragraph");
  assert.equal(snapshot.hoverTranslateDelayMs, 650);
  assert.equal(snapshot.pageTranslateConcurrency, 6);
  assert.equal(snapshot.pageTranslateBatchChars, 420);
  assert.equal("ollamaAutoTranslateSelection" in snapshot, false);
});

test("getStoredSettingsShape 会保留 canonical 通用设置键并格式化数值字段", () => {
  const stored = getStoredSettingsShape({
    provider: "minimax-global",
    minimaxRegion: "global",
    autoTranslateMode: "selection",
    hoverTranslateScope: "paragraph",
    hoverTranslateDelayMs: 700,
    pageTranslateConcurrency: 5,
    pageTranslateBatchChars: 380,
  });

  assert.equal(stored.provider, "minimax-global");
  assert.equal(stored.autoTranslateMode, "selection");
  assert.equal(stored.hoverTranslateScope, "paragraph");
  assert.equal(stored.hoverTranslateDelayMs, "700");
  assert.equal(stored.pageTranslateConcurrency, "5");
  assert.equal(stored.pageTranslateBatchChars, "380");
});