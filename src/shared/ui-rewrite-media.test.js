import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenAiChatUserContent,
  extractDataUrl,
  isImageUnsupportedError,
  mergeRewriteImages,
  normalizeRewriteImages,
  stripDataUrlToBase64,
} from "./ui-rewrite-media.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const jpeg =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

test("normalizeRewriteImages keeps unique image data URLs", () => {
  assert.deepEqual(normalizeRewriteImages([png, { dataUrl: png }, "not-an-image"]), [
    { dataUrl: png },
  ]);
});

test("mergeRewriteImages puts the live screenshot first", () => {
  const merged = mergeRewriteImages(jpeg, [png, png]);
  assert.deepEqual(
    merged.map((image) => image.dataUrl),
    [jpeg, png],
  );
});

test("OpenAI chat content stays a string when there is no image", () => {
  assert.equal(buildOpenAiChatUserContent("hello"), "hello");
});

test("OpenAI chat content includes image_url parts", () => {
  assert.deepEqual(buildOpenAiChatUserContent("fix this", [png]), [
    { type: "text", text: "fix this" },
    { type: "image_url", image_url: { url: png } },
  ]);
});

test("strips data URL prefix for Ollama images", () => {
  assert.equal(stripDataUrlToBase64(png).startsWith("iVBOR"), true);
  assert.equal(extractDataUrl({ dataUrl: png }), png);
});

test("detects image-unsupported provider errors", () => {
  assert.equal(isImageUnsupportedError(new Error("model does not support image")), true);
  assert.equal(isImageUnsupportedError(new Error("rate limited")), false);
});
