import assert from "node:assert/strict";
import test from "node:test";

import {
  ENGLISH_EXAMPLE_PAGE_URL,
  openEnglishExamplePage,
} from "./examplePage.js";

test("opens the configured English example page", () => {
  const calls = [];
  const opened = openEnglishExamplePage({
    tabs: {
      create(options) {
        calls.push(options);
      },
    },
  });

  assert.equal(opened, true);
  assert.deepEqual(calls, [{ url: ENGLISH_EXAMPLE_PAGE_URL }]);
  assert.equal(ENGLISH_EXAMPLE_PAGE_URL, "https://english.www.gov.cn/news/");
});

test("reports unsupported browsers without throwing", () => {
  assert.equal(openEnglishExamplePage({}), false);
});
