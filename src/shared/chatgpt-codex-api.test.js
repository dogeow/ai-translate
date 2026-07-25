import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatGptCodexHeaders,
  buildChatGptCodexRequestBody,
  generateChatGptStreamingCompletion,
  parseChatGptCodexEvent,
} from "./chatgpt-codex-api.js";
import { DEFAULT_CHATGPT_MODEL } from "./constants.js";

test("ChatGPT Codex request defaults to gpt-5.3-codex-spark", () => {
  const body = buildChatGptCodexRequestBody("", "Translate this");
  assert.equal(body.model, DEFAULT_CHATGPT_MODEL);
  assert.equal(body.input[0].content[0].text, "Translate this");
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
});

test("ChatGPT Codex headers include account context without exposing refresh tokens", () => {
  const headers = buildChatGptCodexHeaders(
    {
      accessToken: "access-token",
      refreshToken: "must-not-appear",
      accountId: "account-1",
      isFedRamp: true,
    },
    "request-1",
  );

  assert.equal(headers.Authorization, "Bearer access-token");
  assert.equal(headers["ChatGPT-Account-Id"], "account-1");
  assert.equal(headers["X-OpenAI-FedRamp"], "true");
  assert.equal(JSON.stringify(headers).includes("must-not-appear"), false);
});

test("ChatGPT Codex SSE events expose text deltas and completed output", () => {
  assert.deepEqual(
    parseChatGptCodexEvent({
      type: "response.output_text.delta",
      delta: "hello",
    }),
    { response: "hello", finalResponse: "", error: "" },
  );
  assert.deepEqual(
    parseChatGptCodexEvent({
      type: "response.completed",
      response: {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "hello world" }],
          },
        ],
      },
    }),
    { response: "", finalResponse: "hello world", error: "" },
  );
});

test("ChatGPT Codex streaming restores all deltas", async () => {
  let sent = null;
  const responseBody = [
    'data: {"type":"response.output_text.delta","delta":"尺"}',
    'data: {"type":"response.output_text.delta","delta":"寸"}',
    'data: {"type":"response.completed","response":{"output":[]}}',
    "data: [DONE]",
    "",
  ].join("\n");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const result = await generateChatGptStreamingCompletion(
      "",
      "",
      DEFAULT_CHATGPT_MODEL,
      "Translate dimensions",
      {
        auth: {
          accessToken: "access-token",
          accountId: "account-1",
        },
        fetchImpl: async (url, options) => {
          sent = { url, options };
          return new Response(responseBody, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          });
        },
      },
    );
    assert.equal(result.response, "尺寸");
    assert.equal(
      JSON.parse(sent.options.body).model,
      DEFAULT_CHATGPT_MODEL,
    );
    assert.match(sent.url, /chatgpt\.com\/backend-api\/codex\/responses$/);
  } finally {
    console.log = originalLog;
  }
});
