import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import {
  ARTICLE_NARRATION_MODE,
  ARTICLE_NARRATION_STATUS,
  chooseNarrationVoice,
  collectArticleNarrationSections,
  createArticleNarrator,
  resolveNarrationStartAnchor,
  splitSpeechChunks,
  splitSpeechText,
} from "./articleNarration.js";
import {
  buildSpeechCharMap,
  findWordRangeInElement,
  inferWordLength,
  isWordBoundaryEvent,
  listSpeechWordSpans,
  resolveSpeechRange,
  resolveSpokenWordRange,
} from "./articleNarrationHighlight.js";

function installDom(html) {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const previous = {
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    window: globalThis.window,
    NodeFilter: globalThis.NodeFilter,
  };
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.window = dom.window;
  globalThis.NodeFilter = dom.window.NodeFilter;
  return {
    dom,
    cleanup() {
      dom.window.close();
      Object.entries(previous).forEach(([key, value]) => {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      });
    },
  };
}

test("文章朗读按原文、译文和双语提取段落", () => {
  const harness = installDom(`
    <main>
      <h1>Article title</h1>
      <p id="first"><span class="ollama-pt-wrap"><span class="ollama-pt-orig">Original paragraph.</span><span class="ollama-pt-trans">翻译段落。</span></span></p>
      <nav><p>Navigation text</p></nav>
      <pre>const ignored = true;</pre>
    </main>
  `);
  try {
    const root = document.body;
    const original = collectArticleNarrationSections(root, {
      mode: ARTICLE_NARRATION_MODE.ORIGINAL,
      requireVisible: false,
    });
    const translated = collectArticleNarrationSections(root, {
      mode: ARTICLE_NARRATION_MODE.TRANSLATION,
      requireVisible: false,
    });
    const bilingual = collectArticleNarrationSections(root, {
      mode: ARTICLE_NARRATION_MODE.BILINGUAL,
      requireVisible: false,
    });

    assert.deepEqual(original.map((section) => section.texts), [
      ["Article title"],
      ["Original paragraph."],
    ]);
    assert.deepEqual(translated.map((section) => section.texts), [
      ["翻译段落。"],
    ]);
    assert.deepEqual(bilingual.at(-1).texts, [
      "Original paragraph.",
      "翻译段落。",
    ]);
  } finally {
    harness.cleanup();
  }
});

test("文章朗读可以从鼠标所在段落开始", () => {
  const harness = installDom(`
    <main>
      <p id="one">First paragraph.</p>
      <p id="two"><span id="cursor">Second paragraph.</span></p>
      <p id="three">Third paragraph.</p>
    </main>
  `);
  try {
    const sections = collectArticleNarrationSections(document.body, {
      startElement: document.querySelector("#cursor"),
      requireVisible: false,
    });
    assert.deepEqual(
      sections.map((section) => section.texts[0]),
      ["Second paragraph.", "Third paragraph."],
    );
  } finally {
    harness.cleanup();
  }
});

test("长段落会优先按句子和空格拆成安全语音片段", () => {
  const chunks = splitSpeechText(
    "This is the first sentence. This is a considerably longer second sentence for testing. Final sentence.",
    48,
  );
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 48));
  assert.equal(chunks.join(" ").replace(/\s+/g, " "),
    "This is the first sentence. This is a considerably longer second sentence for testing. Final sentence.");
});

test("语音片段保留源字符串偏移，便于映射 boundary 事件", () => {
  const source =
    "This is the first sentence. This is a considerably longer second sentence for testing. Final sentence.";
  const chunks = splitSpeechChunks(source, 48);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.equal(source.slice(chunk.start, chunk.start + chunk.text.length), chunk.text);
  }
});

test("buildSpeechCharMap 把折叠空白后的字符映射回文本节点", () => {
  const harness = installDom(`
    <main>
      <p id="p">Hello   <strong>world</strong> again.</p>
    </main>
  `);
  try {
    const element = document.querySelector("#p");
    const { text, map } = buildSpeechCharMap(element, "original");
    assert.equal(text, "Hello world again.");
    assert.equal(map.length, text.length);
    const range = resolveSpeechRange(
      { map },
      text.indexOf("world"),
      "world".length,
    );
    assert.ok(range);
    assert.equal(range.toString(), "world");
  } finally {
    harness.cleanup();
  }
});

test("译文模式下 char map 只覆盖 .ollama-pt-trans 文本", () => {
  const harness = installDom(`
    <main>
      <p id="p">
        <span class="ollama-pt-orig">Original only.</span>
        <span class="ollama-pt-trans">翻译 段落。</span>
      </p>
    </main>
  `);
  try {
    const element = document.querySelector("#p");
    const original = buildSpeechCharMap(element, "original");
    const translation = buildSpeechCharMap(element, "translation");
    assert.equal(original.text, "Original only.");
    assert.equal(translation.text, "翻译 段落。");
  } finally {
    harness.cleanup();
  }
});

test("inferWordLength 在缺少 charLength 时按空白切词", () => {
  assert.equal(inferWordLength("Hello world", 0), 5);
  assert.equal(inferWordLength("Hello world", 6), 5);
  assert.equal(inferWordLength("a  b", 1), 2);
});

test("isWordBoundaryEvent 接受 word / 空 name，忽略 sentence", () => {
  assert.equal(isWordBoundaryEvent({ name: "word", charIndex: 0 }), true);
  assert.equal(isWordBoundaryEvent({ name: "", charIndex: 3 }), true);
  assert.equal(isWordBoundaryEvent({ charIndex: 1 }), true);
  assert.equal(isWordBoundaryEvent({ name: "sentence", charIndex: 0 }), false);
  assert.equal(isWordBoundaryEvent(null), false);
});

test("listSpeechWordSpans 列出非空白词及偏移", () => {
  assert.deepEqual(listSpeechWordSpans("China has 11,000 pieces."), [
    { start: 0, length: 5, word: "China" },
    { start: 6, length: 3, word: "has" },
    { start: 10, length: 6, word: "11,000" },
    { start: 17, length: 7, word: "pieces." },
  ]);
});

test("认词 span 拆分后仍能按词解析 Range", () => {
  const harness = installDom(`
    <main>
      <p id="p">China has <span class="ai-tr-word" data-word="dispatched">dispatched</span> supplies.</p>
    </main>
  `);
  try {
    const element = document.querySelector("#p");
    const range = findWordRangeInElement(element, "dispatched", "original");
    assert.ok(range);
    assert.equal(range.toString(), "dispatched");

    const byIndex = resolveSpokenWordRange({
      element,
      mode: "original",
      charIndex: 10,
      charLength: 10,
      textStart: 0,
      word: "dispatched",
    });
    assert.ok(byIndex);
    assert.equal(byIndex.toString(), "dispatched");
  } finally {
    harness.cleanup();
  }
});

test("起读锚点优先点击，否则取视口中线附近段落", () => {
  const harness = installDom(`
    <main style="height:2000px">
      <p id="one">First paragraph.</p>
      <p id="two">Second paragraph.</p>
      <p id="three">Third paragraph.</p>
    </main>
  `);
  try {
    globalThis.innerHeight = 800;
    const two = document.querySelector("#two");
    const three = document.querySelector("#three");
    // Viewport mid is y=400; two is closest to center.
    two.getBoundingClientRect = () => ({
      top: 360, bottom: 400, left: 0, right: 100, width: 100, height: 40,
    });
    three.getBoundingClientRect = () => ({
      top: 520, bottom: 560, left: 0, right: 100, width: 100, height: 40,
    });
    document.querySelector("#one").getBoundingClientRect = () => ({
      top: -200, bottom: -160, left: 0, right: 100, width: 100, height: 40,
    });

    const fromClick = resolveNarrationStartAnchor({
      contentClickTarget: three,
      document: harness.dom.window.document,
    });
    assert.equal(fromClick.source, "click");
    assert.equal(fromClick.element?.id, "three");

    const fromViewport = resolveNarrationStartAnchor({
      document: harness.dom.window.document,
    });
    assert.equal(fromViewport.source, "viewport");
    assert.equal(fromViewport.element?.id, "two");
  } finally {
    harness.cleanup();
  }
});

test("英式、美式和中文文本选择对应系统声音", () => {
  const voices = [
    { name: "US", lang: "en-US" },
    { name: "UK", lang: "en-GB" },
    { name: "CN", lang: "zh-CN" },
  ];
  assert.equal(
    chooseNarrationVoice(voices, { text: "Hello", accent: "uk" }).name,
    "UK",
  );
  assert.equal(
    chooseNarrationVoice(voices, { text: "你好，世界", accent: "us" }).name,
    "CN",
  );
});

test("自然语音优先于 Albert 和 Whisper 等系统特效声音", () => {
  const voices = [
    { name: "Albert", lang: "en-US", localService: true },
    { name: "Whisper", lang: "en-US", localService: true },
    { name: "Samantha", lang: "en-US", localService: true },
    { name: "Daniel", lang: "en-GB", localService: true },
    { name: "婷婷", lang: "zh-CN", localService: true, default: true },
  ];

  assert.equal(
    chooseNarrationVoice(voices, { text: "A natural English article.", accent: "us" }).name,
    "Samantha",
  );
  assert.equal(
    chooseNarrationVoice(voices, { text: "A natural British article.", accent: "uk" }).name,
    "Daniel",
  );
  assert.equal(
    chooseNarrationVoice(voices, { text: "这是一段中文文章。", accent: "us" }).name,
    "婷婷",
  );
});

test("朗读状态机支持逐段播放、暂停、继续和停止", () => {
  const harness = installDom("<main><p>First paragraph.</p><p>Second paragraph.</p></main>");
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }
  const spoken = [];
  const speech = {
    canceled: 0,
    paused: 0,
    resumed: 0,
    speak(utterance) {
      spoken.push(utterance);
    },
    cancel() {
      this.canceled += 1;
    },
    pause() {
      this.paused += 1;
    },
    resume() {
      this.resumed += 1;
    },
    getVoices() {
      return [{ name: "US", lang: "en-US" }];
    },
  };
  try {
    for (const element of document.querySelectorAll("p")) {
      element.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: 0,
        right: 200,
        width: 200,
        height: 20,
      });
    }
    const narrator = createArticleNarrator({
      root: document.body,
      speech,
      Utterance: FakeUtterance,
      scrollCurrentIntoView: false,
    });
    const result = narrator.start();
    assert.equal(result.ok, true);
    assert.equal(narrator.getState().status, ARTICLE_NARRATION_STATUS.PLAYING);
    assert.equal(spoken[0].text, "First paragraph.");
    assert.equal(document.querySelector("p").classList.contains("ollama-article-narration-current"), true);

    narrator.pause();
    assert.equal(narrator.getState().status, ARTICLE_NARRATION_STATUS.PAUSED);
    narrator.resume();
    assert.equal(narrator.getState().status, ARTICLE_NARRATION_STATUS.PLAYING);

    spoken[0].onend();
    assert.equal(spoken[1].text, "Second paragraph.");
    narrator.stop();
    assert.equal(narrator.getState().status, ARTICLE_NARRATION_STATUS.IDLE);
    assert.equal(document.querySelector(".ollama-article-narration-current"), null);
    narrator.destroy();
  } finally {
    harness.cleanup();
  }
});

test("boundary 单词事件会更新 currentWord 并调用高亮，不改写页面 DOM", () => {
  const harness = installDom(
    "<main><p id='p'>First paragraph with words.</p></main>",
  );
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }
  const spoken = [];
  const speech = {
    speak(utterance) {
      spoken.push(utterance);
    },
    cancel() {},
    pause() {},
    resume() {},
    getVoices() {
      return [{ name: "US", lang: "en-US" }];
    },
  };
  const highlightCalls = [];
  const wordHighlighter = {
    clear() {
      highlightCalls.push("clear");
    },
    destroy() {},
    highlightRange(range) {
      highlightCalls.push(range?.toString?.() || "");
      return true;
    },
  };
  try {
    document.querySelector("#p").getBoundingClientRect = () => ({
      top: 100,
      bottom: 120,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
    });
    const narrator = createArticleNarrator({
      root: document.body,
      speech,
      Utterance: FakeUtterance,
      scrollCurrentIntoView: false,
      wordHighlighter,
    });
    const beforeHtml = document.querySelector("#p").innerHTML;
    assert.equal(narrator.start().ok, true);
    assert.equal(typeof spoken[0].onboundary, "function");

    spoken[0].onboundary({ name: "word", charIndex: 0, charLength: 5 });
    assert.equal(narrator.getState().currentWord, "First");
    assert.ok(highlightCalls.includes("First"));

    spoken[0].onboundary({ name: "word", charIndex: 6, charLength: 9 });
    assert.equal(narrator.getState().currentWord, "paragraph");
    assert.ok(highlightCalls.includes("paragraph"));

    // sentence boundary events are ignored
    spoken[0].onboundary({ name: "sentence", charIndex: 0, charLength: 10 });
    assert.equal(narrator.getState().currentWord, "paragraph");

    // Engines that omit name still update the word
    spoken[0].onboundary({ charIndex: 16, charLength: 4 });
    assert.equal(narrator.getState().currentWord, "with");

    assert.equal(document.querySelector("#p").innerHTML, beforeHtml);
    assert.equal(
      document.querySelector("#p").querySelectorAll("mark, span.word").length,
      0,
    );

    narrator.stop();
    assert.equal(narrator.getState().currentWord, "");
    assert.ok(highlightCalls.includes("clear"));
    narrator.destroy();
  } finally {
    harness.cleanup();
  }
});

test("无 boundary 时用计时回退推进当前单词高亮", async () => {
  const harness = installDom("<main><p id='p'>Alpha beta gamma</p></main>");
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }
  const speech = {
    speak() {},
    cancel() {},
    pause() {},
    resume() {},
    getVoices() {
      return [{ name: "US", lang: "en-US" }];
    },
  };
  const words = [];
  const wordHighlighter = {
    clear() {},
    destroy() {},
    highlightRange(range) {
      words.push(range?.toString?.() || "");
      return true;
    },
  };
  try {
    document.querySelector("#p").getBoundingClientRect = () => ({
      top: 100,
      bottom: 120,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
    });
    const narrator = createArticleNarrator({
      root: document.body,
      speech,
      Utterance: FakeUtterance,
      scrollCurrentIntoView: false,
      wordHighlighter,
    });
    assert.equal(narrator.start().ok, true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    assert.ok(words.includes("Alpha") || narrator.getState().currentWord);
    assert.ok(
      ["Alpha", "beta", "gamma"].includes(narrator.getState().currentWord) ||
        words.some((word) => ["Alpha", "beta", "gamma"].includes(word)),
    );
    assert.equal(document.querySelector("#p").querySelectorAll("span").length, 0);
    narrator.destroy();
  } finally {
    harness.cleanup();
  }
});
