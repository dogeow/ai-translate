import assert from "node:assert/strict";
import test from "node:test";

import {
  CHATGPT_DEVICE_VERIFICATION_URL,
  CHATGPT_OAUTH_CLIENT_ID,
  completeChatGptDeviceLogin,
  extractChatGptAccountInfo,
  getValidChatGptAuth,
  requestChatGptDeviceCode,
} from "./chatgpt-auth.js";

function makeJwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

test("ChatGPT JWT claims resolve account, plan and email", () => {
  const token = makeJwt({
    email: "reader@example.com",
    "https://api.openai.com/auth": {
      chatgpt_plan_type: "pro",
      chatgpt_user_id: "user-1",
      chatgpt_account_id: "account-1",
      chatgpt_account_is_fedramp: true,
    },
  });

  assert.deepEqual(extractChatGptAccountInfo(token), {
    email: "reader@example.com",
    planType: "pro",
    userId: "user-1",
    accountId: "account-1",
    isFedRamp: true,
  });
});

test("ChatGPT device login uses the official public client and exchanges the code", async () => {
  const requests = [];
  const accessToken = makeJwt({
    exp: Math.floor(Date.now() / 1000) + 3600,
    "https://api.openai.com/auth": {
      chatgpt_account_id: "account-2",
    },
  });
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/api/accounts/deviceauth/usercode")) {
      return new Response(
        JSON.stringify({
          device_auth_id: "device-1",
          user_code: "ABCD-EFGH",
          interval: "1",
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/api/accounts/deviceauth/token")) {
      const pollCount = requests.filter((item) =>
        item.url.endsWith("/api/accounts/deviceauth/token"),
      ).length;
      if (pollCount === 1) return new Response("", { status: 403 });
      return new Response(
        JSON.stringify({
          authorization_code: "authorization-code",
          code_verifier: "code-verifier",
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/oauth/token")) {
      return new Response(
        JSON.stringify({
          access_token: accessToken,
          refresh_token: "refresh-1",
          id_token: accessToken,
        }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const device = await requestChatGptDeviceCode({ fetchImpl });
  assert.equal(device.verificationUri, CHATGPT_DEVICE_VERIFICATION_URL);
  assert.deepEqual(
    JSON.parse(requests[0].options.body),
    { client_id: CHATGPT_OAUTH_CLIENT_ID },
  );

  let stored = null;
  const auth = await completeChatGptDeviceLogin(device, {
    fetchImpl,
    sleepImpl: async () => {},
    setStored: async (value) => {
      stored = value;
    },
  });

  const exchangeRequest = requests.at(-1);
  assert.equal(exchangeRequest.options.body.get("grant_type"), "authorization_code");
  assert.equal(exchangeRequest.options.body.get("code"), "authorization-code");
  assert.equal(exchangeRequest.options.body.get("client_id"), CHATGPT_OAUTH_CLIENT_ID);
  assert.equal(auth.accountId, "account-2");
  assert.equal(stored.refreshToken, "refresh-1");
});

test("expired ChatGPT access tokens refresh and preserve a rotating login", async () => {
  const refreshedToken = makeJwt({
    exp: Math.floor(Date.now() / 1000) + 7200,
  });
  let stored = null;
  let refreshBody = null;

  const auth = await getValidChatGptAuth({
    currentAuth: {
      accessToken: "expired-token",
      refreshToken: "old-refresh",
      idToken: "",
      expiresAt: Date.now() - 1000,
    },
    fetchImpl: async (_url, options) => {
      refreshBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          access_token: refreshedToken,
          refresh_token: "rotated-refresh",
        }),
        { status: 200 },
      );
    },
    setStored: async (value) => {
      stored = value;
    },
  });

  assert.deepEqual(refreshBody, {
    client_id: CHATGPT_OAUTH_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: "old-refresh",
  });
  assert.equal(auth.refreshToken, "rotated-refresh");
  assert.equal(stored.accessToken, refreshedToken);
});
