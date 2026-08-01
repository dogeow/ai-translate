import assert from "node:assert/strict";
import test from "node:test";
import {
  isHoverModifierActive,
  isHoverModifierKeyEvent,
} from "./hoverModifier.js";

test("Option or Alt is the default hover modifier", () => {
  assert.equal(isHoverModifierActive({ altKey: true }, "alt"), true);
  assert.equal(isHoverModifierActive({ shiftKey: true }, "alt"), false);
  assert.equal(isHoverModifierKeyEvent({ key: "Alt" }, "alt"), true);
});

test("configured modifiers read their matching event flags", () => {
  assert.equal(isHoverModifierActive({ shiftKey: true }, "shift"), true);
  assert.equal(isHoverModifierActive({ ctrlKey: true }, "control"), true);
  assert.equal(isHoverModifierActive({ metaKey: true }, "meta"), true);
  assert.equal(isHoverModifierKeyEvent({ key: "Shift" }, "shift"), true);
  assert.equal(isHoverModifierKeyEvent({ key: "Control" }, "control"), true);
  assert.equal(isHoverModifierKeyEvent({ key: "Meta" }, "meta"), true);
});

test("disabled hover modifier never activates", () => {
  assert.equal(
    isHoverModifierActive(
      { altKey: true, shiftKey: true, ctrlKey: true, metaKey: true },
      "none",
    ),
    false,
  );
  assert.equal(isHoverModifierKeyEvent({ key: "Alt" }, "none"), false);
});
