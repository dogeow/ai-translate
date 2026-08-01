import assert from "node:assert/strict";
import test from "node:test";

import { getSidePanelSupport, openSidePanel } from "./sidePanel.js";

test("opens the Chrome side panel for the current window", async () => {
  const calls = [];
  const chromeApi = {
    sidePanel: {
      open(options) {
        calls.push(options);
        return Promise.resolve();
      },
    },
  };

  assert.deepEqual(getSidePanelSupport(chromeApi, {}), {
    chrome: true,
    firefox: false,
  });

  await openSidePanel({ windowId: 27, chromeApi, browserApi: {} });
  assert.deepEqual(calls, [{ windowId: 27 }]);
});

test("falls back to the Firefox sidebar API", async () => {
  let openCount = 0;
  const browserApi = {
    sidebarAction: {
      open() {
        openCount += 1;
        return Promise.resolve();
      },
    },
  };

  assert.deepEqual(getSidePanelSupport({}, browserApi), {
    chrome: false,
    firefox: true,
  });

  await openSidePanel({ chromeApi: {}, browserApi });
  assert.equal(openCount, 1);
});

test("rejects when Chrome has no current window id", async () => {
  const chromeApi = {
    sidePanel: {
      open() {
        throw new Error("should not be called");
      },
    },
  };

  await assert.rejects(
    openSidePanel({ chromeApi, browserApi: {} }),
    /Missing current window id/,
  );
});
