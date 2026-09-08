import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { initUiRewrite } from "./uiRewrite.js";

test("rewrite prompt stays visible and busy after capture until generation finishes", async (t) => {
  const dom = new JSDOM("<body><button>页面按钮</button></body>", {
    pretendToBeVisual: true,
    url: "https://example.com/",
  });
  const previous = { document: globalThis.document, window: globalThis.window, chrome: globalThis.chrome };
  let listener;
  let finishGeneration;
  let onGeneration;
  const generationStarted = new Promise((resolve) => { onGeneration = resolve; });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: (callback) => { listener = callback; },
        removeListener: () => {},
      },
      sendMessage: (message, callback) => {
        if (message.action === "generateUiRewrite") {
          finishGeneration = callback;
          onGeneration();
        } else {
          callback({ ok: true, rule: null });
        }
      },
    },
  };
  const cleanup = initUiRewrite();
  t.after(() => {
    cleanup();
    dom.window.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  listener({ action: "openUiRewritePrompt" });
  const overlay = document.getElementById("__ai_translate_ui_rewrite_overlay__");
  const submit = overlay.querySelector('[data-act="submit"]');
  overlay.querySelector("textarea").value = "增大按钮";
  submit.click();
  await generationStarted;
  assert.equal(overlay.style.opacity, "0");

  listener({ action: "uiRewriteScreenshotCaptured" }, {}, () => {});
  assert.equal(overlay.style.opacity, "1");
  assert.equal(overlay.style.pointerEvents, "");
  assert.equal(submit.disabled, true);
  assert.match(overlay.textContent, /AI 生成中/);

  finishGeneration({ ok: false, error: "服务暂时不可用" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(submit.disabled, false);
  assert.equal(overlay.dataset.busy, undefined);
  assert.match(overlay.textContent, /服务暂时不可用/);
});
