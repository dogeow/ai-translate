import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { createPageTranslateBar } from "./pageTranslateBar.js";

function createHarness() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;

  let mode = "translation";
  let modeListener = null;
  const translator = {
    getDisplayMode: () => mode,
    setDisplayMode(nextMode) {
      mode = nextMode;
      modeListener?.(nextMode);
    },
    onDisplayModeChange(listener) {
      modeListener = listener;
      return () => {
        modeListener = null;
      };
    },
  };
  const bar = createPageTranslateBar(translator);

  return {
    bar,
    document: dom.window.document,
    cleanup() {
      bar.destroy();
      globalThis.document = previousDocument;
      dom.window.close();
    },
  };
}

test("认词模式在页面翻译控制条位置显示认词率", () => {
  const harness = createHarness();
  try {
    harness.bar.setRecognitionStats({
      knownCount: 3,
      totalCount: 4,
      percentage: 75,
    });

    const element = harness.document.querySelector("#ollama-pt-bar");
    assert.ok(element);
    assert.equal(
      element.classList.contains("ollama-pt-bar--recognition-only"),
      true,
    );
    assert.equal(
      element.querySelector(".ollama-pt-bar-recognition-label").textContent,
      "认词率 75%",
    );
    assert.equal(
      element.querySelector(".ollama-pt-bar-row").hidden,
      true,
    );
  } finally {
    harness.cleanup();
  }
});

test("页面翻译和认词模式共用控制条且可独立关闭", () => {
  const harness = createHarness();
  try {
    harness.bar.setRecognitionStats({
      knownCount: 1,
      totalCount: 2,
      percentage: 50,
    });
    harness.bar.show();

    const element = harness.document.querySelector("#ollama-pt-bar");
    assert.equal(
      element.classList.contains("ollama-pt-bar--recognition-only"),
      false,
    );
    assert.equal(element.querySelector(".ollama-pt-bar-row").hidden, false);
    assert.equal(
      element.querySelector(".ollama-pt-bar-recognition-row").hidden,
      false,
    );

    harness.bar.hide();
    assert.ok(harness.document.querySelector("#ollama-pt-bar"));
    assert.equal(
      element.classList.contains("ollama-pt-bar--recognition-only"),
      true,
    );
    assert.equal(
      element.querySelector(".ollama-pt-bar-row").hidden,
      true,
    );

    harness.bar.setRecognitionStats(null);
    assert.equal(harness.document.querySelector("#ollama-pt-bar"), null);
  } finally {
    harness.cleanup();
  }
});
