import assert from "node:assert/strict";
import test from "node:test";
import {
  getWordLearningStatus,
  KNOWN_WORDS_STORAGE_KEY,
  resolveWordLearningStatus,
  setWordLearningStatus,
  STUDYING_WORDS_STORAGE_KEY,
} from "./word-learning.js";

function installChromeStorage(initial = {}) {
  const state = structuredClone(initial);
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (key in state) result[key] = structuredClone(state[key]);
          }
          callback(result);
        },
        set(updates, callback) {
          Object.assign(state, structuredClone(updates));
          callback();
        },
      },
    },
  };
  return state;
}

test("resolves known, studying and unmarked states", () => {
  assert.equal(resolveWordLearningStatus("Known", { known: {} }, {}), "known");
  assert.equal(
    resolveWordLearningStatus("Study", {}, { study: {} }),
    "studying",
  );
  assert.equal(resolveWordLearningStatus("new", {}, {}), "unmarked");
});

test("switches a word atomically between studying and known", async (t) => {
  t.after(() => delete globalThis.chrome);
  const state = installChromeStorage({
    [KNOWN_WORDS_STORAGE_KEY]: {
      though: { addedAt: 1 },
    },
    [STUDYING_WORDS_STORAGE_KEY]: {},
  });

  await setWordLearningStatus("Though.", "studying");
  assert.deepEqual(state[KNOWN_WORDS_STORAGE_KEY], {
    though: { addedAt: 1 },
  });

  await setWordLearningStatus("Though", "studying");
  assert.equal(state[KNOWN_WORDS_STORAGE_KEY].though, undefined);
  assert.equal(state[STUDYING_WORDS_STORAGE_KEY].though.level, -1);

  await setWordLearningStatus("Though", "known");
  assert.equal(state[STUDYING_WORDS_STORAGE_KEY].though, undefined);
  assert.ok(state[KNOWN_WORDS_STORAGE_KEY].though.addedAt > 0);

  assert.deepEqual(await getWordLearningStatus("though"), {
    word: "though",
    status: "known",
  });
});
