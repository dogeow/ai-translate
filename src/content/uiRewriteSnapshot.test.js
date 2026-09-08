import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { collectUiRewriteSnapshot } from "./uiRewriteSnapshot.js";

test("collects visible buttons, text and images for CSS rewrite context", () => {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <h1>couch</h1>
      <button class="know">认识</button>
      <button class="unknown">不认识</button>
      <img class="word-image" alt="沙发" src="https://example.com/couch.png">
      <div id="__ai_translate_ui_rewrite_overlay__"><button>生成</button></div>
    </body></html>`,
    { pretendToBeVisual: true },
  );
  Object.defineProperty(dom.window.HTMLElement.prototype, "getBoundingClientRect", {
    value() {
      return { width: 120, height: 32, top: 10, left: 10, bottom: 42, right: 130 };
    },
  });

  const snapshot = collectUiRewriteSnapshot(dom.window.document, {
    skipIds: ["__ai_translate_ui_rewrite_overlay__"],
  });

  assert.match(snapshot, /h1 "couch"/);
  assert.match(snapshot, /button\.know "认识"/);
  assert.match(snapshot, /img\.word-image alt="沙发" has-image/);
  assert.equal(snapshot.includes("生成"), false);
  dom.window.close();
});
