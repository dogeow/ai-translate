import assert from "node:assert/strict";
import test from "node:test";

import { mergeWordSnapshots } from "./dogeow-word-sync.js";

test("mergeWordSnapshots prefers the more recently active entry", () => {
  const merged = mergeWordSnapshots(
    {
      known: {},
      studying: {
        apple: {
          addedAt: 1000,
          level: 0,
          lastReviewedAt: 2000,
          lastAction: "remember",
          history: [{ at: 2000, action: "remember" }],
        },
      },
    },
    {
      known: {
        apple: { addedAt: 1500 },
      },
      studying: {
        banana: {
          addedAt: 3000,
          level: -1,
          lastReviewedAt: null,
          lastAction: null,
          history: [],
        },
      },
    },
    5000,
  );

  assert.ok(merged.studying.apple);
  assert.equal(merged.studying.apple.level, 0);
  assert.equal(merged.known.apple, undefined);
  assert.ok(merged.studying.banana);
});

test("mergeWordSnapshots keeps known when it is newer than studying", () => {
  const merged = mergeWordSnapshots(
    {
      known: {
        hello: { addedAt: 9000 },
      },
      studying: {},
    },
    {
      known: {},
      studying: {
        hello: {
          addedAt: 1000,
          level: 1,
          lastReviewedAt: 2000,
          history: [],
        },
      },
    },
  );

  assert.ok(merged.known.hello);
  assert.equal(merged.studying.hello, undefined);
});
