import assert from "node:assert/strict";
import test from "node:test";

import { handleUiRewriteMessage } from "./uiRewriteService.js";

const screenshot = "data:image/jpeg;base64,c2NyZWVuc2hvdA==";

function createEvent() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (...args) => listeners.forEach((listener) => listener(...args)),
    get size() { return listeners.size; },
  };
}

function setup(t, { active = true, beforeCapture, duringCapture, rejectImages = false } = {}) {
  const tab = { id: 7, windowId: 1, active, url: "https://example.com/", title: "Example" };
  const onActivated = createEvent();
  const onUpdated = createEvent();
  const requests = [];
  const messages = [];
  let captures = 0;
  const storage = {};
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    if (rejectImages && body.images?.length) {
      return Response.json({ error: "model does not support images" }, { status: 400 });
    }
    return Response.json({ response: "body { color: red; }" });
  });
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {},
    storage: {
      sync: {
        get: async () => ({ provider: "ollama", uiRewriteProvider: "ollama", addedProviders: ["ollama"], ollamaModel: "test-model" }),
        set: async () => {},
      },
      local: {
        get: (_key, callback) => callback(structuredClone(storage)),
        set: (updates, callback) => { Object.assign(storage, structuredClone(updates)); callback(); },
      },
    },
    tabs: {
      onActivated,
      onUpdated,
      get: async () => ({ ...tab }),
      query: async () => [],
      sendMessage: (_id, message, callback) => {
        messages.push(message.action);
        if (message.action === "collectUiRewriteContext") beforeCapture?.(tab);
        callback({ html: "button.submit" });
      },
      captureVisibleTab: async () => {
        captures += 1;
        duringCapture?.({ tab, onActivated, onUpdated });
        return screenshot;
      },
    },
  };
  t.after(async () => {
    // Allow the existing request-log persistence queue to drain.
    await new Promise((resolve) => setImmediate(resolve));
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });
  return {
    requests, messages, onActivated, onUpdated,
    get captures() { return captures; },
    generate: () => handleUiRewriteMessage({ action: "generateUiRewrite", tabId: tab.id, url: "https://example.com/", prompt: "修正按钮" }, {}),
  };
}

test("rewrite attaches the target page screenshot and restores the prompt before generation", async (t) => {
  const fixture = setup(t);
  assert.equal((await fixture.generate()).ok, true);
  assert.deepEqual(fixture.requests[0].images, ["c2NyZWVuc2hvdA=="]);
  assert.ok(fixture.messages.includes("uiRewriteScreenshotCaptured"));
  assert.equal(fixture.onActivated.size, 0);
  assert.equal(fixture.onUpdated.size, 0);
});

test("rewrite never captures a background tab's window", async (t) => {
  const fixture = setup(t, { active: false });
  assert.equal((await fixture.generate()).ok, true);
  assert.equal(fixture.captures, 0);
  assert.equal(fixture.requests[0].images, undefined);
});

test("rewrite checks the active tab again after collecting context", async (t) => {
  const fixture = setup(t, { beforeCapture: (tab) => { tab.active = false; } });
  await fixture.generate();
  assert.equal(fixture.captures, 0);
  assert.equal(fixture.requests[0].images, undefined);
});

test("rewrite discards a screenshot when tabs switch away and back during capture", async (t) => {
  const fixture = setup(t, {
    duringCapture: ({ tab, onActivated }) => {
      onActivated.emit({ tabId: 8, windowId: tab.windowId });
      onActivated.emit({ tabId: tab.id, windowId: tab.windowId });
    },
  });
  await fixture.generate();
  assert.equal(fixture.requests[0].images, undefined);
  assert.equal(fixture.onActivated.size, 0);
  assert.equal(fixture.onUpdated.size, 0);
});

test("rewrite discards a screenshot when the page navigates during capture", async (t) => {
  const fixture = setup(t, {
    duringCapture: ({ tab, onUpdated }) => {
      tab.url = "https://other.example/";
      onUpdated.emit(tab.id, { url: tab.url }, tab);
    },
  });
  await fixture.generate();
  assert.equal(fixture.requests[0].images, undefined);
});

test("Ollama image rejection retries with text and no screenshot claim", async (t) => {
  const fixture = setup(t, { rejectImages: true });
  assert.equal((await fixture.generate()).ok, true);
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.requests[1].images, undefined);
  assert.doesNotMatch(fixture.requests[1].prompt, /已附上当前页面截图/);
  assert.match(fixture.requests[1].prompt, /button\.submit/);
});
