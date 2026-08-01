import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { HOVER_TARGET_INDICATOR_ID } from "./constants.js";
import {
  hideHoverTargetIndicator,
  removeHoverTargetIndicator,
  showHoverTargetIndicator,
} from "./hoverTargetIndicator.js";

function installDom() {
  const dom = new JSDOM("<body></body>", {
    pretendToBeVisual: true,
    url: "https://example.com/",
  });
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  return () => {
    dom.window.close();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  };
}

test("hover target indicator follows the active word or paragraph rectangle", () => {
  const cleanup = installDom();

  try {
    showHoverTargetIndicator(
      { top: 20, left: 30, width: 80, height: 20 },
      "word",
    );
    const indicator = document.getElementById(HOVER_TARGET_INDICATOR_ID);
    assert.ok(indicator);
    assert.equal(indicator.dataset.scope, "word");
    assert.equal(indicator.style.display, "block");
    assert.equal(indicator.style.left, "28px");
    assert.equal(indicator.style.width, "84px");

    showHoverTargetIndicator(
      { top: 40, left: 50, width: 300, height: 90 },
      "paragraph",
    );
    assert.equal(indicator.dataset.scope, "paragraph");
    assert.equal(indicator.style.left, "46px");
    assert.equal(indicator.style.width, "308px");

    hideHoverTargetIndicator();
    assert.equal(indicator.style.display, "none");
    removeHoverTargetIndicator();
    assert.equal(
      document.getElementById(HOVER_TARGET_INDICATOR_ID),
      null,
    );
  } finally {
    cleanup();
  }
});
