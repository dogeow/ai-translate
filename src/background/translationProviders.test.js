import assert from "node:assert/strict";
import test from "node:test";

import { runProviderCompletion } from "./translationProviders.js";

for (const provider of ["minimax-cn", "github-models"]) {
  test(`${provider} forwards rewrite images while preserving text-only requests`, async (t) => {
    const requests = [];
    t.mock.method(console, "log", () => {});
    t.mock.method(globalThis, "fetch", async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return Response.json({ choices: [{ message: { content: "body {}" } }] });
    });
    const options = {
      provider, base: "https://provider.example", model: "test-model",
      apiKey: "test-key", prompt: "Fix layout",
    };
    const dataUrl = "data:image/png;base64,c2NyZWVuc2hvdA==";
    assert.equal(await runProviderCompletion({ ...options, images: [dataUrl] }), "body {}");
    assert.deepEqual(requests[0].messages[0].content, [
      { type: "text", text: "Fix layout" },
      { type: "image_url", image_url: { url: dataUrl } },
    ]);
    await runProviderCompletion(options);
    assert.equal(requests[1].messages[0].content, "Fix layout");
  });
}
