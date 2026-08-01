import assert from "node:assert/strict";
import test from "node:test";

import { resolveUiRewriteViewState } from "./uiRewriteState.js";

test("reports no active rewrite when the page has no saved rule", () => {
  assert.deepEqual(resolveUiRewriteViewState(null), {
    hasRule: false,
    isActive: false,
    activeVersionLabel: "",
  });
});

test("reports original rewrite versions as inactive", () => {
  assert.deepEqual(
    resolveUiRewriteViewState({
      activeVersionId: "original",
      versions: [{ id: "v1", label: "版本 1" }],
    }),
    {
      hasRule: true,
      isActive: false,
      activeVersionLabel: "",
    },
  );
});

test("resolves the active rewrite version label", () => {
  assert.deepEqual(
    resolveUiRewriteViewState({
      activeVersionId: "v2",
      versions: [
        { id: "v1", label: "版本 1" },
        { id: "v2", label: "护眼版" },
      ],
    }),
    {
      hasRule: true,
      isActive: true,
      activeVersionLabel: "护眼版",
    },
  );
});
