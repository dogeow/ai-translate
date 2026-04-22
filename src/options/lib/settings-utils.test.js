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