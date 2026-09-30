import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { usePageTranslate } from "./usePopupSettings.js";
import { ALWAYS_TRANSLATE_ORIGINS_KEY } from "../../shared/constants.js";

async function createHarness() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://extension-test.invalid" });
  const names = ["window", "document", "chrome", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let tab = { id: 1, url: "https://alpha.example/article", active: true };
  let latest;
  const messages = [];
  const writes = [];
  const activated = new Set();
  const updated = new Set();
  const listenerApi = (listeners) => ({ addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) });
  globalThis.chrome = {
    runtime: { lastError: undefined },
    tabs: {
      query: (_query, callback) => callback([{ ...tab }]),
      sendMessage: (tabId, message, callback) => messages.push({ tabId, message, callback }),
      onActivated: listenerApi(activated),
      onUpdated: listenerApi(updated),
    },
    storage: {
      sync: {
        get: (_keys, callback) => callback({ [ALWAYS_TRANSLATE_ORIGINS_KEY]: [] }),
        set: (updates, callback) => writes.push({ updates, callback }),
      },
    },
  };
  function Harness() { latest = usePageTranslate(true); return null; }
  const root = createRoot(dom.window.document.getElementById("root"));
  const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  await act(async () => { root.render(createElement(Harness)); });
  await flush();
  return {
    get state() { return latest; }, messages, writes, flush,
    async respond(action, tabId, response, error) {
      const message = messages.find((item) => item.tabId === tabId && item.message.action === action && !item.done);
      assert.ok(message, `Missing ${action} for tab ${tabId}`);
      message.done = true;
      await act(async () => {
        chrome.runtime.lastError = error ? { message: error } : undefined;
        message.callback(response);
        chrome.runtime.lastError = undefined;
      });
    },
    async activate(id, url) {
      tab = { id, url, active: true };
      await act(async () => { for (const listener of activated) listener({ tabId: id }); });
      await flush();
    },
    async navigate(url) {
      tab = { ...tab, url };
      await act(async () => { for (const listener of updated) listener(tab.id, { url }, tab); });
      await flush();
    },
    async invoke(callback) { await act(async () => { callback(latest); }); await flush(); },
    async completeWrite() { assert.ok(writes.length); await act(async () => { writes.shift().callback(); }); await flush(); },
    async cleanup() {
      await act(async () => { root.unmount(); });
      dom.window.close();
      for (const name of names) {
        const descriptor = previous.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

test("late start response cannot overwrite the newly selected tab", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: false, mode: "translation" });
    await h.invoke((state) => state.togglePageTranslate());
    await h.activate(2, "https://beta.example/read");
    await h.respond("getPageTranslateState", 2, { ok: true, active: true, mode: "original" });
    await h.respond("startVisualPageTranslate", 1, { ok: true, active: true, mode: "translation" });
    assert.equal(h.state.activeOrigin, "https://beta.example");
    assert.equal(h.state.displayMode, "original");
    assert.equal(h.state.status, "");
    assert.equal(h.state.isToggling, false);
  } finally { await h.cleanup(); }
});

test("late display-mode failure cannot disable translation on another tab", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: true, mode: "translation" });
    await h.invoke((state) => state.changeDisplayMode("bilingual"));
    await h.activate(2, "https://beta.example/read");
    await h.respond("getPageTranslateState", 2, { ok: true, active: true, mode: "original" });
    await h.respond("setPageTranslateMode", 1, undefined, "Receiving end does not exist");
    assert.equal(h.state.isPageTranslateActive, true);
    assert.equal(h.state.displayMode, "original");
    assert.equal(h.state.status, "");
  } finally { await h.cleanup(); }
});

test("completing an old site preference never starts translation on the new tab", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: false });
    await h.invoke((state) => { void state.toggleSiteAutoTranslate(); });
    assert.equal(h.writes.length, 1);
    await h.activate(2, "https://beta.example/read");
    await h.respond("getPageTranslateState", 2, { ok: true, active: false });
    await h.completeWrite();
    assert.equal(h.state.siteAutoTranslateEnabled, false);
    assert.equal(h.state.status, "");
    assert.equal(h.messages.some((item) => item.tabId === 2 && item.message.action === "startVisualPageTranslate"), false);
  } finally { await h.cleanup(); }
});

test("navigation inside the same tab invalidates old translation callbacks", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: false });
    await h.invoke((state) => state.togglePageTranslate());
    await h.navigate("https://alpha.example/another-article");
    await h.respond("getPageTranslateState", 1, { ok: true, active: false });
    await h.respond("startVisualPageTranslate", 1, { ok: true, active: true });
    assert.equal(h.state.isPageTranslateActive, false);
    assert.equal(h.state.status, "");
  } finally { await h.cleanup(); }
});

test("a late refresh cannot undo a successful page translation mutation", async () => {
  const h = await createHarness();
  try {
    await h.invoke((state) => state.togglePageTranslate());
    await h.respond("startVisualPageTranslate", 1, { ok: true, active: true, mode: "bilingual" });
    await h.respond("getPageTranslateState", 1, { ok: true, active: false, mode: "translation" });
    assert.equal(h.state.isPageTranslateActive, true);
    assert.equal(h.state.displayMode, "bilingual");
  } finally { await h.cleanup(); }
});

test("repeated page actions are single-flight and a successful mutation still updates its own tab", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: false });
    await h.invoke((state) => { void state.togglePageTranslate(); void state.togglePageTranslate(); });
    assert.equal(h.messages.filter((item) => item.message.action === "startVisualPageTranslate").length, 1);
    await h.respond("startVisualPageTranslate", 1, { ok: true, active: true, mode: "translation" });
    assert.equal(h.state.isPageTranslateActive, true);
    assert.match(h.state.status, /已启动/);
    await h.invoke((state) => state.changeDisplayMode("bilingual"));
    await h.respond("setPageTranslateMode", 1, { ok: true, mode: "bilingual" });
    assert.equal(h.state.displayMode, "bilingual");
    assert.equal(h.state.isChangingDisplayMode, false);
  } finally { await h.cleanup(); }
});

test("site preference completion does not restart translation already started manually", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: false });
    await h.invoke((state) => { void state.toggleSiteAutoTranslate(); void state.toggleSiteAutoTranslate(); });
    assert.equal(h.writes.length, 1);
    assert.equal(h.state.isTogglingSiteAutoTranslate, true);
    await h.invoke((state) => state.togglePageTranslate());
    await h.respond("startVisualPageTranslate", 1, { ok: true, active: true });
    await h.completeWrite();
    assert.equal(h.state.siteAutoTranslateEnabled, true);
    assert.equal(h.state.isTogglingSiteAutoTranslate, false);
    assert.equal(h.messages.filter((item) => item.message.action === "startVisualPageTranslate").length, 1);
    assert.equal(h.messages.some((item) => item.message.action === "stopVisualPageTranslate"), false);
  } finally { await h.cleanup(); }
});

test("an active-tab query change before the activation event does not send a command", async () => {
  const h = await createHarness();
  try {
    await h.respond("getPageTranslateState", 1, { ok: true, active: false });
    chrome.tabs.query = (_query, callback) => callback([{ id: 2, url: "https://beta.example/read", active: true }]);
    await h.invoke((state) => state.togglePageTranslate());
    assert.equal(h.messages.some((item) => item.message.action === "startVisualPageTranslate"), false);
    assert.equal(h.state.isToggling, false);
    assert.equal(h.state.activeOrigin, "https://beta.example");
  } finally { await h.cleanup(); }
});
