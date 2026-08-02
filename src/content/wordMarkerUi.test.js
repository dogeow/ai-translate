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
  applyWordStatusToMarkerContext,
  collectChangedWordKeys,
  cleanupWordMarkerLinks,
  prepareWordMarkerLink,
  resolveWordMarkerCardPosition,
  shouldSkipWordMarkerNode,
  updateWordMarkersForWord,
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

test("认词模式不会标记 Git 哈希中的同名字母片段", () => {
  const dom = new JSDOM(
    "<main>commit a4bd760 92a7bc9 pushed <strong>bd</strong></main>",
  );
  const root = dom.window.document.body;

  updateWordMarkersForWord(root, "bd", {
    recognitionModeEnabled: true,
    knownWords: {},
    studyingWords: {},
  });

  const markers = root.querySelectorAll('[data-word="bd"]');
  assert.equal(markers.length, 1);
  assert.equal(markers[0].closest("strong")?.textContent, "bd");
  assert.match(root.textContent, /a4bd760 92a7bc9/);
  dom.window.close();
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

test("标记为熟词时只移除页面上的同词标记", () => {
  const dom = new JSDOM(`
    <main>
      <p>
        <span class="ai-tr-word ai-tr-word--recognition" data-word="target">Target</span>
        <span class="ai-tr-word ai-tr-word--recognition" data-word="other">other</span>
        <span class="ai-tr-word ai-tr-word--recognition" data-word="target">target</span>
      </p>
    </main>
  `);
  const root = dom.window.document.body;
  const otherMarker = root.querySelector('[data-word="other"]');
  const context = applyWordStatusToMarkerContext(
    { recognitionModeEnabled: true, knownWords: {}, studyingWords: {} },
    "target",
    "known",
  );

  updateWordMarkersForWord(root, "target", context);

  assert.equal(root.querySelectorAll('[data-word="target"]').length, 0);
  assert.equal(otherMarker.isConnected, true);
  assert.equal(root.querySelector('[data-word="other"]'), otherMarker);
  assert.match(root.textContent, /Target\s+other\s+target/);
  dom.window.close();
});

test("单个单词移出熟词表时只重新标记该词", () => {
  const dom = new JSDOM(`
    <main>
      <p>Target <span class="ai-tr-word ai-tr-word--recognition" data-word="other">other</span> target</p>
    </main>
  `);
  const root = dom.window.document.body;
  const otherMarker = root.querySelector('[data-word="other"]');
  const context = applyWordStatusToMarkerContext(
    {
      recognitionModeEnabled: true,
      knownWords: { target: { addedAt: 1 } },
      studyingWords: {},
    },
    "target",
    "unmarked",
  );

  updateWordMarkersForWord(root, "target", context);

  assert.equal(root.querySelectorAll('[data-word="target"]').length, 2);
  assert.equal(root.querySelector('[data-word="other"]'), otherMarker);
  dom.window.close();
});

test("本地存储变化只返回真正改变的单词", () => {
  assert.deepEqual(
    collectChangedWordKeys({
      knownWords: {
        oldValue: { same: { addedAt: 1 } },
        newValue: { same: { addedAt: 1 }, target: { addedAt: 2 } },
      },
      studyingWords: {
        oldValue: { target: { level: -1 } },
        newValue: {},
      },
    }),
    ["target"],
  );
});
