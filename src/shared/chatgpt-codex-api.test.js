import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildChatGptCodexHeaders,
  buildChatGptCodexRequestBody,
  buildChatGptModelsUrl,
  fetchChatGptModels,
  generateChatGptStreamingCompletion,
  parseChatGptCodexEvent,
  parseChatGptCodexModels,
} from "./chatgpt-codex-api.js";
import {
  CHATGPT_CODEX_CLIENT_VERSION,
  CHATGPT_CODEX_ORIGINATOR,
  CHATGPT_CODEX_USER_AGENT,
  DEFAULT_CHATGPT_MODEL,
} from "./constants.js";

test("ChatGPT Codex request defaults to gpt-5.6-luna", () => {
  const body = buildChatGptCodexRequestBody("", "Translate this");
  assert.equal(body.model, DEFAULT_CHATGPT_MODEL);
  assert.equal(DEFAULT_CHATGPT_MODEL, "gpt-5.6-luna");
  assert.equal(body.input[0].content[0].text, "Translate this");
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
});

test("ChatGPT fallback model list includes the default model", async () => {
  const { CHATGPT_MODEL_FALLBACK_LIST } = await import("./constants.js");
  assert.ok(CHATGPT_MODEL_FALLBACK_LIST.includes(DEFAULT_CHATGPT_MODEL));
  assert.ok(CHATGPT_MODEL_FALLBACK_LIST.length >= 3);
});

test("ChatGPT Codex model list filters hidden and non-api models", () => {
  assert.deepEqual(
    parseChatGptCodexModels({
      models: [
        { slug: "gpt-5.6-luna", visibility: "list", supported_in_api: true },
        { slug: "gpt-5.6-sol-wm", visibility: "hide", supported_in_api: false },
        { slug: "codex-auto-review", visibility: "hide", supported_in_api: true },
        { slug: "gpt-5.6-terra", visibility: "list", supported_in_api: true },
        { slug: "gpt-5.6-luna", visibility: "list", supported_in_api: true },
      ],
    }),
    ["gpt-5.6-luna", "gpt-5.6-terra"],
  );
});

test("ChatGPT Codex models URL includes client_version", () => {
  assert.equal(
    buildChatGptModelsUrl(),
    `https://chatgpt.com/backend-api/codex/models?client_version=${encodeURIComponent(CHATGPT_CODEX_CLIENT_VERSION)}`,
  );
});

test("fetchChatGptModels requests the Codex models endpoint", async () => {
  let sent = null;
  const models = await fetchChatGptModels({
    auth: {
      accessToken: "access-token",
      accountId: "account-1",
    },
    forceRefresh: true,
    fetchImpl: async (url, options) => {
      sent = { url, options };
      return new Response(
        JSON.stringify({
          models: [
            {
              slug: "gpt-5.6-luna",
              visibility: "list",
              supported_in_api: true,
            },
            {
              slug: "gpt-5.6-sol",
              visibility: "list",
              supported_in_api: true,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });

  assert.deepEqual(models, ["gpt-5.6-luna", "gpt-5.6-sol"]);
  assert.match(sent.url, /chatgpt\.com\/backend-api\/codex\/models\?client_version=/);
  assert.equal(sent.options.method, "GET");
  assert.equal(sent.options.headers.Accept, "application/json");
  assert.equal(sent.options.headers.Authorization, "Bearer access-token");
  assert.equal(sent.options.headers["ChatGPT-Account-Id"], "account-1");
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
  assert.equal(headers.Originator, CHATGPT_CODEX_ORIGINATOR);
  assert.equal(headers["User-Agent"], CHATGPT_CODEX_USER_AGENT);
  assert.equal("Version" in headers, false);
  assert.equal(JSON.stringify(headers).includes("must-not-appear"), false);
});

test("Chromium rewrites the Codex User-Agent to the supported client version", () => {
  const rules = JSON.parse(
    readFileSync(
      new URL(
        "../rules/chatgpt-codex-client-headers.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const userAgentRule = rules[0]?.action?.requestHeaders?.find(
    (header) => header.header.toLowerCase() === "user-agent",
  );

  assert.equal(userAgentRule?.operation, "set");
  assert.equal(userAgentRule?.value, CHATGPT_CODEX_USER_AGENT);
  assert.equal(
    rules[0]?.condition?.urlFilter,
    "||chatgpt.com/backend-api/codex/",
  );
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
