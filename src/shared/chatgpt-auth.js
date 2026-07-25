export const CHATGPT_AUTH_STORAGE_KEY = "chatgptCodexAuth";
export const CHATGPT_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CHATGPT_AUTH_BASE_URL = "https://auth.openai.com";
export const CHATGPT_DEVICE_VERIFICATION_URL =
  "https://auth.openai.com/codex/device";
export const CHATGPT_DEVICE_LOGIN_TIMEOUT_MS = 15 * 60 * 1000;

const DEVICE_CODE_URL = `${CHATGPT_AUTH_BASE_URL}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${CHATGPT_AUTH_BASE_URL}/api/accounts/deviceauth/token`;
const OAUTH_TOKEN_URL = `${CHATGPT_AUTH_BASE_URL}/oauth/token`;
const OAUTH_REVOKE_URL = `${CHATGPT_AUTH_BASE_URL}/oauth/revoke`;
const DEVICE_REDIRECT_URI = `${CHATGPT_AUTH_BASE_URL}/deviceauth/callback`;
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;

let refreshPromise = null;

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  throw new Error("当前环境无法解析 ChatGPT 登录令牌。");
}

export function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return {};
    const decoded = JSON.parse(decodeBase64Url(payload));
    return decoded && typeof decoded === "object" ? decoded : {};
  } catch (_) {
    return {};
  }
}

function readAuthClaims(token) {
  const claims = decodeJwtPayload(token);
  const authClaims = claims["https://api.openai.com/auth"];
  const profileClaims = claims["https://api.openai.com/profile"];
  return {
    claims,
    auth:
      authClaims && typeof authClaims === "object" ? authClaims : {},
    profile:
      profileClaims && typeof profileClaims === "object" ? profileClaims : {},
  };
}

function resolveExpiresAt(tokenResponse, accessToken) {
  const jwtExpiry = Number(decodeJwtPayload(accessToken)?.exp);
  if (Number.isFinite(jwtExpiry) && jwtExpiry > 0) {
    return jwtExpiry * 1000;
  }
  const expiresIn = Number(tokenResponse?.expires_in);
  return Number.isFinite(expiresIn) && expiresIn > 0
    ? Date.now() + expiresIn * 1000
    : 0;
}

export function extractChatGptAccountInfo(idToken, accessToken = "") {
  const id = readAuthClaims(idToken);
  const access = readAuthClaims(accessToken);
  const auth = Object.keys(id.auth).length > 0 ? id.auth : access.auth;
  const claims = Object.keys(id.claims).length > 0 ? id.claims : access.claims;
  const profile =
    Object.keys(id.profile).length > 0 ? id.profile : access.profile;

  return {
    email: String(claims.email || profile.email || "").trim(),
    planType: String(auth.chatgpt_plan_type || "").trim(),
    userId: String(auth.chatgpt_user_id || auth.user_id || "").trim(),
    accountId: String(auth.chatgpt_account_id || "").trim(),
    isFedRamp: auth.chatgpt_account_is_fedramp === true,
  };
}

export function normalizeStoredChatGptAuth(value = {}) {
  if (!value || typeof value !== "object") return null;
  const accessToken = String(value.accessToken || value.access_token || "").trim();
  const refreshToken = String(
    value.refreshToken || value.refresh_token || "",
  ).trim();
  const idToken = String(value.idToken || value.id_token || "").trim();
  if (!accessToken && !refreshToken) return null;

  const account = extractChatGptAccountInfo(idToken, accessToken);
  return {
    accessToken,
    refreshToken,
    idToken,
    expiresAt:
      Number(value.expiresAt) || resolveExpiresAt(value, accessToken),
    email: String(value.email || account.email || "").trim(),
    planType: String(value.planType || account.planType || "").trim(),
    userId: String(value.userId || account.userId || "").trim(),
    accountId: String(value.accountId || account.accountId || "").trim(),
    isFedRamp: value.isFedRamp === true || account.isFedRamp,
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

function storageLocalGet(key) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result?.[key] ?? null);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageLocalSet(payload) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageLocalRemove(key) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function loadChatGptAuth(options = {}) {
  const getStored =
    options.getStored || (() => storageLocalGet(CHATGPT_AUTH_STORAGE_KEY));
  return normalizeStoredChatGptAuth(await getStored());
}

export async function saveChatGptAuth(auth, options = {}) {
  const normalized = normalizeStoredChatGptAuth(auth);
  if (!normalized?.accessToken) {
    throw new Error("ChatGPT 登录返回的访问令牌无效。");
  }
  const setStored =
    options.setStored ||
    ((value) => storageLocalSet({ [CHATGPT_AUTH_STORAGE_KEY]: value }));
  await setStored(normalized);
  return normalized;
}

export async function clearChatGptAuth(options = {}) {
  const removeStored =
    options.removeStored || (() => storageLocalRemove(CHATGPT_AUTH_STORAGE_KEY));
  await removeStored();
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return { message: text };
  }
}

function getAuthErrorMessage(payload, fallback) {
  return String(
    payload?.error_description ||
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      fallback,
  ).trim();
}

export async function requestChatGptDeviceCode(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: CHATGPT_OAUTH_CLIENT_ID }),
    signal: options.signal,
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(
      getAuthErrorMessage(payload, "ChatGPT 设备登录初始化失败。"),
    );
  }

  const deviceAuthId = String(payload.device_auth_id || "").trim();
  const userCode = String(payload.user_code || "").trim();
  if (!deviceAuthId || !userCode) {
    throw new Error("ChatGPT 设备登录未返回有效验证码。");
  }

  return {
    deviceAuthId,
    userCode,
    interval: Math.max(1, Number(payload.interval) || 5),
    verificationUri: CHATGPT_DEVICE_VERIFICATION_URL,
  };
}

function waitFor(ms, signal, sleepImpl) {
  if (sleepImpl) return sleepImpl(ms, signal);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
      return;
    }
    let timer = null;
    const finish = (callback) => {
      if (timer != null) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => {
      finish(() =>
        reject(signal.reason || new DOMException("Aborted", "AbortError")),
      );
    };
    timer = setTimeout(() => finish(resolve), ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function pollChatGptDeviceCode(device, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const startedAt = Number(options.startedAt) || Date.now();
  const timeoutMs =
    Number(options.timeoutMs) || CHATGPT_DEVICE_LOGIN_TIMEOUT_MS;
  const intervalMs = Math.max(1000, Number(device?.interval || 5) * 1000);

  for (;;) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("ChatGPT 设备登录已超时，请重新开始。");
    }
    await waitFor(intervalMs, options.signal, options.sleepImpl);

    const response = await fetchImpl(DEVICE_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_auth_id: String(device?.deviceAuthId || "").trim(),
        user_code: String(device?.userCode || "").trim(),
      }),
      signal: options.signal,
    });

    if (response.status === 403 || response.status === 404) {
      options.onPending?.();
      continue;
    }

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(
        getAuthErrorMessage(payload, "ChatGPT 设备登录授权失败。"),
      );
    }

    const authorizationCode = String(
      payload.authorization_code || "",
    ).trim();
    const codeVerifier = String(payload.code_verifier || "").trim();
    if (!authorizationCode || !codeVerifier) {
      throw new Error("ChatGPT 设备登录授权结果不完整。");
    }
    return {
      authorizationCode,
      codeVerifier,
    };
  }
}

function normalizeTokenResponse(payload, previous = {}) {
  const accessToken = String(payload?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("ChatGPT 登录未返回访问令牌。");
  }
  const refreshToken = String(
    payload?.refresh_token || previous.refreshToken || "",
  ).trim();
  const idToken = String(payload?.id_token || previous.idToken || "").trim();
  return normalizeStoredChatGptAuth({
    accessToken,
    refreshToken,
    idToken,
    expiresAt: resolveExpiresAt(payload, accessToken),
    updatedAt: Date.now(),
  });
}

export async function exchangeChatGptDeviceCode(code, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(code?.authorizationCode || "").trim(),
    redirect_uri: DEVICE_REDIRECT_URI,
    client_id: CHATGPT_OAUTH_CLIENT_ID,
    code_verifier: String(code?.codeVerifier || "").trim(),
  });
  const response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: options.signal,
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(
      getAuthErrorMessage(payload, "ChatGPT 登录令牌交换失败。"),
    );
  }
  const auth = normalizeTokenResponse(payload);
  return saveChatGptAuth(auth, options);
}

export async function completeChatGptDeviceLogin(device, options = {}) {
  const code = await pollChatGptDeviceCode(device, options);
  return exchangeChatGptDeviceCode(code, options);
}

async function refreshChatGptAuthInner(current, options = {}) {
  if (!current?.refreshToken) {
    throw new Error("ChatGPT 登录已过期，请重新完成设备登录。");
  }
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CHATGPT_OAUTH_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
    }),
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    const error = new Error(
      getAuthErrorMessage(payload, "ChatGPT 登录刷新失败，请重新登录。"),
    );
    error.status = response.status;
    throw error;
  }
  return saveChatGptAuth(normalizeTokenResponse(payload, current), options);
}

export async function getValidChatGptAuth(options = {}) {
  const current =
    options.currentAuth || (await loadChatGptAuth(options));
  if (!current) {
    throw new Error("请先完成 ChatGPT 设备登录。");
  }
  const shouldRefresh =
    options.forceRefresh === true ||
    !current.accessToken ||
    (current.expiresAt > 0 &&
      current.expiresAt <= Date.now() + TOKEN_REFRESH_WINDOW_MS);
  if (!shouldRefresh) return current;

  if (!refreshPromise) {
    refreshPromise = refreshChatGptAuthInner(current, options).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function getChatGptAuthSummary(options = {}) {
  try {
    const auth = options.refresh
      ? await getValidChatGptAuth(options)
      : await loadChatGptAuth(options);
    if (!auth) return { isLoggedIn: false };
    return {
      isLoggedIn: true,
      email: auth.email,
      planType: auth.planType,
      accountId: auth.accountId,
      expiresAt: auth.expiresAt,
    };
  } catch (error) {
    return {
      isLoggedIn: false,
      error: error?.message || String(error),
    };
  }
}

export async function logoutChatGpt(options = {}) {
  const current = await loadChatGptAuth(options);
  try {
    if (current?.refreshToken) {
      const fetchImpl = options.fetchImpl || fetch;
      await fetchImpl(OAUTH_REVOKE_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: current.refreshToken,
          token_type_hint: "refresh_token",
          client_id: CHATGPT_OAUTH_CLIENT_ID,
        }),
      }).catch(() => null);
    }
  } finally {
    await clearChatGptAuth(options);
  }
}
