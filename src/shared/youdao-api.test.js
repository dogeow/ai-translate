import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYoudaoAudioUrl,
  buildYoudaoLookupUrl,
  isPronounceableEnglishWord,
  lookupYoudao,
} from "./youdao-api.js";

test("buildYoudaoAudioUrl uses DogeOW's Youdao accent parameters", () => {
  assert.equal(
    buildYoudaoAudioUrl("hello world", 1),
    "https://dict.youdao.com/dictvoice?audio=hello%20world&type=1",
  );
  assert.equal(
    buildYoudaoAudioUrl("dimensions", 2),
    "https://dict.youdao.com/dictvoice?audio=dimensions&type=2",
  );
});

test("buildYoudaoLookupUrl uses DogeOW's mobile query parameters", () => {
  assert.equal(
    buildYoudaoLookupUrl("it's"),
    "https://dict.youdao.com/jsonapi_s?q=it%27s&le=en&client=mobile",
  );
});

test("lookupYoudao uses a GET request without legacy webdict parameters", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let capturedUrl = "";
  let capturedOptions = null;
  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return {
      ok: true,
      async json() {
        return {
          ec: {
            word: [
              {
                usphone: "ɪts",
                trs: [{ pos: "pron.", tran: "它的" }],
              },
            ],
          },
        };
      },
    };
  };

  const result = await lookupYoudao("its");
  assert.equal(
    capturedUrl,
    "https://dict.youdao.com/jsonapi_s?q=its&le=en&client=mobile",
  );
  assert.equal(capturedOptions.method, "GET");
  assert.equal("body" in capturedOptions, false);
  assert.equal(result.usphone, "ɪts");
  assert.deepEqual(result.translations, ["pron. 它的"]);
});

test("isPronounceableEnglishWord limits the tip button to English words", () => {
  assert.equal(isPronounceableEnglishWord("dimensions"), true);
  assert.equal(isPronounceableEnglishWord("well-known"), true);
  assert.equal(isPronounceableEnglishWord("don't"), true);
  assert.equal(isPronounceableEnglishWord("hello world"), false);
  assert.equal(isPronounceableEnglishWord("尺寸"), false);
});
