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
import {
  cleanupWordMarkerLinks,
  prepareWordMarkerLink,
  resolveWordMarkerCardPosition,
  shouldSkipWordMarkerNode,
} from "./wordMarker.js";

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

test("链接中的认词标记保留链接原色并可完整清理", () => {
  const dom = new JSDOM(
    '<main><a style="color: rgb(29, 20, 18)">promote recovery</a></main>',
    { pretendToBeVisual: true },
  );
  const link = dom.window.document.querySelector("a");

  prepareWordMarkerLink(link);
  assert.equal(link.classList.contains("ai-tr-word--link"), true);
  assert.equal(
    link.style.getPropertyValue("--ai-tr-word-link-color"),
    "rgb(29, 20, 18)",
  );

  cleanupWordMarkerLinks(dom.window.document);
  assert.equal(link.classList.contains("ai-tr-word--link"), false);
  assert.equal(link.style.getPropertyValue("--ai-tr-word-link-color"), "");
  dom.window.close();
});

test("认词卡片靠近右侧时收进视口", () => {
  assert.deepEqual(
    resolveWordMarkerCardPosition({
      anchorRect: { top: 120, bottom: 140, left: 610 },
      cardWidth: 300,
      cardHeight: 180,
      viewportWidth: 640,
      viewportHeight: 480,
    }),
    { left: 332, top: 146 },
  );
});

test("认词卡片靠近底部时翻到单词上方", () => {
  assert.deepEqual(
    resolveWordMarkerCardPosition({
      anchorRect: { top: 430, bottom: 450, left: 120 },
      cardWidth: 300,
      cardHeight: 180,
      viewportWidth: 640,
      viewportHeight: 480,
      scrollX: 20,
      scrollY: 500,
    }),
    { left: 140, top: 744 },
  );
});
