import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
  BUTTON_ID,
  HOVER_TARGET_INDICATOR_ID,
  SHORTCUT_HINT_ID,
  TIP_ID,
  WORD_MARKER_CARD_ID,
} from "./constants.js";
import { shouldSkipWordMarkerNode } from "./wordMarker.js";

function createTextNodeInside(id, text = "extension text") {
  const dom = new JSDOM(`<main><div id="${id}"><span>${text}</span></div></main>`);
  return dom.window.document.querySelector("span").firstChild;
}

test("插件自身 UI 的文本不会进入认词模式标记", () => {
  const extensionUiIds = [
    BUTTON_ID,
    TIP_ID,
    SHORTCUT_HINT_ID,
    HOVER_TARGET_INDICATOR_ID,
    WORD_MARKER_CARD_ID,
    "__ai_translate_ui_rewrite_overlay__",
  ];

  for (const id of extensionUiIds) {
    assert.equal(
      shouldSkipWordMarkerNode(createTextNodeInside(id)),
      true,
      `${id} 应被跳过`,
    );
  }
});

test("普通网页文本仍可进入认词模式标记", () => {
  const dom = new JSDOM("<main><p><span>ordinary page text</span></p></main>");
  const textNode = dom.window.document.querySelector("span").firstChild;

  assert.equal(shouldSkipWordMarkerNode(textNode), false);
});
