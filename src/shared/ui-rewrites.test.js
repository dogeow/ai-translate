import assert from "node:assert/strict";
import test from "node:test";

import {
  UI_REWRITE_ORIGINAL_VERSION,
  buildUiRewriteSystemPrompt,
  buildUiRewriteUserPrompt,
  getActiveCss,
  getActiveVersion,
  stripCssFences,
} from "./ui-rewrites.js";

test("getActiveVersion ignores original and missing rules", () => {
  assert.equal(getActiveVersion(null), null);
  assert.equal(
    getActiveVersion({
      activeVersionId: UI_REWRITE_ORIGINAL_VERSION,
      versions: [{ id: "v1", css: "body{color:red}" }],
    }),
    null,
  );
});

test("getActiveCss returns the active version CSS", () => {
  const rule = {
    activeVersionId: "v2",
    versions: [
      { id: "v1", css: "a{}" },
      { id: "v2", css: "button{color:#fff}" },
    ],
  };
  assert.equal(getActiveVersion(rule)?.id, "v2");
  assert.equal(getActiveCss(rule), "button{color:#fff}");
});

test("rewrite system prompt asks to refine previous CSS", () => {
  const prompt = buildUiRewriteSystemPrompt({ hasPreviousCss: true });
  assert.match(prompt, /上一版 CSS/);
  assert.match(prompt, /不要隐藏、覆盖或替换 img/);
});

test("rewrite user prompt includes previous CSS, page structure and screenshot note", () => {
  const prompt = buildUiRewriteUserPrompt({
    url: "https://example.com/word",
    title: "couch",
    prompt: "按钮重叠了，图片也不见了",
    htmlSnapshot: 'button.know "认识"\nimg.word-image has-image',
    previousPrompt: "改成暗色",
    previousCss: "body{background:#000}",
    hasImages: true,
  });
  assert.match(prompt, /https:\/\/example.com\/word/);
  assert.match(prompt, /button\.know "认识"/);
  assert.match(prompt, /上一版需求：改成暗色/);
  assert.match(prompt, /body\{background:#000\}/);
  assert.match(prompt, /按钮重叠了/);
  assert.match(prompt, /截图/);
});

test("stripCssFences removes markdown wrappers", () => {
  assert.equal(stripCssFences("```css\nbody{}\n```"), "body{}");
});

test("corrections retain the entire previous stylesheet", () => {
  const previousCss = "body { color: red; }\n".repeat(700) + "button { color: blue; }";
  const prompt = buildUiRewriteUserPrompt({ prompt: "增大按钮", previousCss });
  assert.ok(prompt.includes(previousCss));
});
