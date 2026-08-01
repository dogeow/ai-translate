import assert from "node:assert/strict";
import test from "node:test";

import { resolvePageTranslateState } from "./pageTranslateState.js";

test("legacy mode responses do not disable an active page translation", () => {
  assert.deepEqual(
    resolvePageTranslateState(
      { ok: true, mode: "original" },
      { active: true, mode: "translation" },
    ),
    { active: true, mode: "original" },
  );
});

test("an explicit inactive response still disables page display controls", () => {
  assert.deepEqual(
    resolvePageTranslateState(
      { active: false, mode: "bilingual", ok: true },
      { active: true, mode: "translation" },
    ),
    { active: false, mode: "bilingual" },
  );
});

test("invalid modes preserve the current display mode", () => {
  assert.deepEqual(
    resolvePageTranslateState(
      { active: true, mode: "unsupported", ok: true },
      { active: true, mode: "original" },
    ),
    { active: true, mode: "original" },
  );
});
