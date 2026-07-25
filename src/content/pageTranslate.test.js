import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { isChineseIdentifierText } from "../shared/translation-language.js";
import { createVisualPageTranslator } from "./pageTranslate.js";

function installDom(html) {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    url: "https://example.com/",
  });
  const previousGlobals = {};
  const domGlobals = {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    MutationObserver: dom.window.MutationObserver,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    window: dom.window,
  };

  Object.entries(domGlobals).forEach(([key, value]) => {
    previousGlobals[key] = globalThis[key];
    globalThis[key] = value;
  });
  Object.defineProperty(dom.window, "innerHeight", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(dom.window, "innerWidth", {
    configurable: true,
    value: 1200,
  });
  dom.window.getComputedStyle = () => ({
    display: "block",
    opacity: "1",
    visibility: "visible",
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    bottom: 40,
    height: 20,
    left: 0,
    right: 300,
    top: 20,
    width: 300,
  });

  return () => {
    dom.window.close();
    Object.entries(previousGlobals).forEach(([key, value]) => {
      if (value === undefined) {
        delete globalThis[key];
      } else {
        globalThis[key] = value;
      }
    });
  };
}

async function waitFor(assertion, timeoutMs = 2000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  throw lastError || new Error("waitFor timeout");
}

function createTranslator(overrides = {}) {
  return createVisualPageTranslator({
    requestChunkTranslation: async (text) => ({
      ok: true,
      translation: `translated:${text}`,
    }),
    onStatusMessage() {},
    shouldSkipText: isChineseIdentifierText,
    isUiElement: () => false,
    initialOptions: {
      batchChars: 128,
      maxConcurrent: 1,
      translationContext: "Chinese",
    },
    ...overrides,
  });
}

test("Chinese page text is translated while code and interactive text are skipped", async () => {
  const cleanupDom = installDom(`
    <body>
      <p id="content">中文内容</p>
      <code id="code">代码内容</code>
      <button id="button">按钮文字</button>
      <p id="identifier">版本2026</p>
    </body>
  `);
  const translator = createTranslator();

  try {
    translator.start();
    await waitFor(() => {
      assert.equal(
        document.querySelector("#content .ollama-pt-trans")?.textContent,
        "translated:中文内容",
      );
    });

    assert.equal(document.querySelector("#code .ollama-pt-wrap"), null);
    assert.equal(document.querySelector("#button .ollama-pt-wrap"), null);
    assert.equal(document.querySelector("#identifier .ollama-pt-wrap"), null);
  } finally {
    translator.stop();
    cleanupDom();
  }
});

test("a target-language switch discards an older in-flight response", async () => {
  const cleanupDom = installDom("<body><p id='content'>中文内容</p></body>");
  let resolveFirstRequest;
  let requestCount = 0;
  const translator = createTranslator({
    requestChunkTranslation: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Promise((resolve) => {
          resolveFirstRequest = resolve;
        });
      }
      return { ok: true, translation: "fresh translation" };
    },
  });

  try {
    translator.start();
    await waitFor(() => assert.equal(requestCount, 1));
    translator.updateOptions({ translationContext: "English" });
    resolveFirstRequest({ ok: true, translation: "stale translation" });

    await waitFor(() => {
      assert.equal(
        document.querySelector("#content .ollama-pt-trans")?.textContent,
        "fresh translation",
      );
    });
    assert.equal(requestCount, 2);
    assert.equal(document.body.textContent.includes("stale translation"), false);
  } finally {
    translator.stop();
    cleanupDom();
  }
});

test("stopping page translation discards an in-flight response", async () => {
  const cleanupDom = installDom("<body><p id='content'>中文内容</p></body>");
  let resolveRequest;
  let requestCount = 0;
  const translator = createTranslator({
    requestChunkTranslation: async () => {
      requestCount += 1;
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    },
  });

  try {
    translator.start();
    await waitFor(() => assert.equal(requestCount, 1));
    translator.stop();
    resolveRequest({ ok: true, translation: "late translation" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.equal(document.querySelector("#content .ollama-pt-wrap"), null);
  } finally {
    translator.stop();
    cleanupDom();
  }
});

test("translation cache is reused within a context and isolated after switching", async () => {
  const cleanupDom = installDom("<body><p>中文内容</p></body>");
  let requestCount = 0;
  const translator = createTranslator({
    requestChunkTranslation: async () => {
      requestCount += 1;
      return {
        ok: true,
        translation:
          requestCount === 1 ? "first context" : "second context",
      };
    },
  });

  try {
    translator.start();
    await waitFor(() =>
      assert.equal(document.querySelectorAll(".ollama-pt-wrap").length, 1),
    );

    document.body.insertAdjacentHTML("beforeend", "<p>中文内容</p>");
    await waitFor(() =>
      assert.equal(document.querySelectorAll(".ollama-pt-wrap").length, 2),
    );
    assert.equal(requestCount, 1);

    translator.updateOptions({ translationContext: "English" });
    document.body.insertAdjacentHTML("beforeend", "<p>中文内容</p>");
    await waitFor(() =>
      assert.equal(document.querySelectorAll(".ollama-pt-wrap").length, 3),
    );
    assert.equal(requestCount, 2);
    assert.equal(
      document.querySelectorAll(".ollama-pt-trans")[2].textContent,
      "second context",
    );
  } finally {
    translator.stop();
    cleanupDom();
  }
});
