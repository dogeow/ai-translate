import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import {
  resolveHoverTranslateScope,
  resolveShortcutTranslationTarget,
} from "./selection.js";

function installDom(html) {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    url: "https://appleinsider.com/articles/example",
  });
  const previousGlobals = {
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    window: globalThis.window,
  };
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.window = dom.window;

  return () => {
    dom.window.close();
    Object.entries(previousGlobals).forEach(([key, value]) => {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    });
  };
}

test("repeating the shortcut expands a selected word only to its paragraph", () => {
  const cleanup = installDom(`
    <body>
      <div class="block article-body">
        <p id="selected">Despite Blizzard's history, Overwatch returns.</p>
        <p id="other">This is another paragraph in the same article.</p>
      </div>
    </body>
  `);

  try {
    const paragraph = document.querySelector("#selected");
    const first = resolveShortcutTranslationTarget({
      currentElement: paragraph,
      currentText: "Blizzard's",
      lastTranslatedElement: null,
      lastTranslatedText: "",
    });
    const second = resolveShortcutTranslationTarget({
      currentElement: paragraph,
      currentText: "Blizzard's",
      lastTranslatedElement: first.anchorElement,
      lastTranslatedText: first.anchorText,
    });

    assert.equal(first.text, "Blizzard's");
    assert.equal(first.source, "selection");
    assert.equal(second.targetElement, paragraph);
    assert.equal(
      second.text,
      "Despite Blizzard's history, Overwatch returns.",
    );
    assert.equal(second.text.includes("another paragraph"), false);
    assert.equal(second.source, "expand");
  } finally {
    cleanup();
  }
});

test("repeating a shortcut from inline markup resolves the nearest paragraph", () => {
  const cleanup = installDom(`
    <body>
      <div class="block article-body">
        <p id="selected">
          Overwatch returns to <a id="link"><span id="word">iPhone</span></a>.
        </p>
        <p>Unrelated article text.</p>
      </div>
    </body>
  `);

  try {
    const word = document.querySelector("#word");
    const result = resolveShortcutTranslationTarget({
      currentElement: word,
      currentText: "iPhone",
      lastTranslatedElement: word,
      lastTranslatedText: "iPhone",
    });

    assert.equal(result.targetElement.id, "selected");
    assert.match(result.text, /Overwatch returns to iPhone/);
    assert.equal(result.text.includes("Unrelated article text"), false);
  } finally {
    cleanup();
  }
});

test("a different selection in the same paragraph starts a new word translation", () => {
  const cleanup = installDom(`
    <body>
      <div class="block article-body">
        <p id="selected">Blizzard brings Overwatch to iPhone.</p>
      </div>
    </body>
  `);

  try {
    const paragraph = document.querySelector("#selected");
    const result = resolveShortcutTranslationTarget({
      currentElement: paragraph,
      currentText: "Overwatch",
      lastTranslatedElement: paragraph,
      lastTranslatedText: "Blizzard",
    });

    assert.equal(result.text, "Overwatch");
    assert.equal(result.source, "selection");
  } finally {
    cleanup();
  }
});

test("the active modifier temporarily inverts the configured hover scope", () => {
  assert.equal(resolveHoverTranslateScope("word", false), "word");
  assert.equal(resolveHoverTranslateScope("word", true), "paragraph");
  assert.equal(resolveHoverTranslateScope("paragraph", false), "paragraph");
  assert.equal(resolveHoverTranslateScope("paragraph", true), "word");
});

test("a broad article container is not treated as a paragraph fallback", () => {
  const longArticleText = "article text ".repeat(140);
  const cleanup = installDom(`
    <body>
      <div class="block article-body">
        <span id="word">Overwatch</span>${longArticleText}
      </div>
    </body>
  `);

  try {
    const word = document.querySelector("#word");
    const result = resolveShortcutTranslationTarget({
      currentElement: word,
      currentText: "Overwatch",
      lastTranslatedElement: word,
      lastTranslatedText: "Overwatch",
    });

    assert.equal(result.text, "Overwatch");
    assert.equal(result.source, "selection");
    assert.equal(result.targetElement, word);
  } finally {
    cleanup();
  }
});
