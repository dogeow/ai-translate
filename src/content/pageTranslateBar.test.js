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

function createNarrationHarness() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  let listener = null;
  let state = {
    status: "idle",
    mode: "original",
    accent: "us",
    rate: 1,
    sectionIndex: 0,
    totalSections: 0,
    error: "",
  };
  const calls = { togglePause: 0, stop: 0, options: [] };
  const narrator = {
    getState: () => ({ ...state }),
    onStateChange(nextListener) {
      listener = nextListener;
      nextListener({ ...state });
      return () => {
        listener = null;
      };
    },
    togglePause() {
      calls.togglePause += 1;
    },
    stop() {
      calls.stop += 1;
    },
    setOptions(options) {
      calls.options.push(options);
    },
  };
  const translator = {
    getDisplayMode: () => "translation",
    setDisplayMode() {},
  };
  const bar = createPageTranslateBar(translator, narrator);

  return {
    bar,
    calls,
    document: dom.window.document,
    setState(nextState) {
      state = { ...state, ...nextState };
      listener?.({ ...state });
    },
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

test("文章朗读启动后显示进度、暂停、停止和朗读选项", () => {
  const harness = createNarrationHarness();
  try {
    harness.setState({
      status: "playing",
      sectionIndex: 2,
      totalSections: 5,
    });
    const element = harness.document.querySelector("#ollama-pt-bar");
    assert.ok(element);
    assert.equal(
      element.querySelector(".ollama-pt-bar-narration-label").textContent,
      "文章朗读 2 / 5",
    );

    harness.setState({
      status: "playing",
      sectionIndex: 2,
      totalSections: 5,
      currentWord: "highlight",
    });
    assert.equal(
      element.querySelector(".ollama-pt-bar-narration-label").textContent,
      "文章朗读 2 / 5 · highlight",
    );

    element.querySelector('[data-action="narration-pause"]').click();
    element.querySelector('[data-action="narration-stop"]').click();
    assert.equal(harness.calls.togglePause, 1);
    assert.equal(harness.calls.stop, 1);

    const accentSelect = element.querySelector(
      ".ollama-pt-bar-narration-accent",
    );
    accentSelect.value = "uk";
    accentSelect.dispatchEvent(new harness.document.defaultView.Event("change"));
    assert.deepEqual(harness.calls.options.at(-1), { accent: "uk" });

    harness.setState({ status: "idle" });
    assert.equal(harness.document.querySelector("#ollama-pt-bar"), null);
  } finally {
    harness.cleanup();
  }
});
