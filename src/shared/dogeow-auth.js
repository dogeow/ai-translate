/**
 * DogeOW SSO（next.dogeow.com）— 浏览器扩展 PKCE 登录
 *
 * 流程：
 * 1. 生成 PKCE verifier/challenge
 * 2. chrome.identity.launchWebAuthFlow 打开 next.dogeow.com/auth/sso/ai-translate
 * 3. 登录成功后 ticket 回跳到 https://<ext-id>.chromiumapp.org/
 * 4. 用 ticket + verifier 换取 Sanctum token
 */

export const DOGEOW_AUTH_STORAGE_KEY = "dogeowAuth";
export const DOGEOW_SSO_CLIENT = "ai-translate";
export const DOGEOW_ACCOUNT_URL = "https://next.dogeow.com";
export const DOGEOW_API_URL = "https://next-api.dogeow.com";

const PKCE_VERIFIER_KEY = "dogeowSsoVerifier";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPkcePair() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
    throw new Error("当前浏览器不支持安全登录所需的加密能力。");
  }
  const verifier = base64Url(globalThis.crypto.getRandomValues(new Uint8Array(48)));
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

function getLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (value) => resolve(value || {}));
  });
}

function setLocal(updates) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function removeLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

export async function getDogeowAuth() {
  const stored = await getLocal(DOGEOW_AUTH_STORAGE_KEY);
  const auth = stored[DOGEOW_AUTH_STORAGE_KEY];
  return auth && typeof auth === "object" ? auth : null;
}

export async function setDogeowAuth(auth) {
  if (!auth) {
    await removeLocal(DOGEOW_AUTH_STORAGE_KEY);
    return null;
  }
  await setLocal({ [DOGEOW_AUTH_STORAGE_KEY]: auth });
  return auth;
}

export async function clearDogeowAuth() {
  await removeLocal([DOGEOW_AUTH_STORAGE_KEY, PKCE_VERIFIER_KEY]);
}

export function isDogeowLoggedIn(auth) {
  return Boolean(String(auth?.token || "").trim());
}

async function apiRequest(path, { method = "GET", body, token, fetchImpl = fetch } = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchImpl(`${DOGEOW_API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  if (!response.ok) {
    const message =
      json?.message ||
      (text ? text.slice(0, 200) : `DogeOW 请求失败（HTTP ${response.status}）`);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (json && typeof json === "object" && typeof json.success === "boolean" && "data" in json) {
    return json.data;
  }
  return json;
}

export async function fetchDogeowUser(auth, options = {}) {
  const token = String(auth?.token || "").trim();
  if (!token) throw new Error("尚未登录 DogeOW。");
  return apiRequest("/api/user", { token, fetchImpl: options.fetchImpl });
}

export async function getDogeowAuthSummary(options = {}) {
  const auth = await getDogeowAuth();
  if (!isDogeowLoggedIn(auth)) {
    return { isLoggedIn: false, auth: null, user: null, error: "" };
  }
  try {
    const user = options.skipProfile
      ? auth.user || null
      : await fetchDogeowUser(auth, options);
    if (user && user !== auth.user) {
      await setDogeowAuth({ ...auth, user });
    }
    return {
      isLoggedIn: true,
      auth,
      user: user || auth.user || null,
      error: "",
    };
  } catch (error) {
    if (error?.status === 401) {
      await clearDogeowAuth();
      return {
        isLoggedIn: false,
        auth: null,
        user: null,
        error: "登录已过期，请重新登录。",
      };
    }
    return {
      isLoggedIn: true,
      auth,
      user: auth.user || null,
      error: error?.message || String(error),
    };
  }
}

function extractTicketFromRedirect(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("ticket") ||
      new URLSearchParams(parsed.hash.replace(/^#/, "")).get("ticket") ||
      ""
    );
  } catch (_) {
    return "";
  }
}

async function exchangeTicket(ticket, codeVerifier, options = {}) {
  const data = await apiRequest("/api/auth/sso/exchange", {
    method: "POST",
    body: {
      client: DOGEOW_SSO_CLIENT,
      ticket,
      code_verifier: codeVerifier,
    },
    fetchImpl: options.fetchImpl,
  });

  const token = String(data?.token || "").trim();
  const user = data?.user || data?.identity || null;
  if (!token) {
    throw new Error("登录服务未返回有效令牌。");
  }

  return setDogeowAuth({
    token,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email ?? null,
        }
      : null,
    loggedInAt: Date.now(),
  });
}

/**
 * 启动 DogeOW SSO 登录（Chrome identity 优先，失败则提示）。
 */
export async function beginDogeowSsoLogin(options = {}) {
  if (typeof chrome === "undefined" || !chrome.identity?.launchWebAuthFlow) {
    throw new Error("当前浏览器不支持扩展 SSO 弹窗登录，请使用 Chrome 或兼容内核。");
  }

  const { verifier, challenge } = await createPkcePair();
  await setLocal({ [PKCE_VERIFIER_KEY]: verifier });

  const redirectUrl =
    options.redirectUrl ||
    chrome.identity.getRedirectURL("sso");
  const loginUrl = new URL(`${DOGEOW_ACCOUNT_URL}/auth/sso/${DOGEOW_SSO_CLIENT}`);
  loginUrl.searchParams.set("return_to", redirectUrl);
  loginUrl.searchParams.set("code_challenge", challenge);

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: loginUrl.href, interactive: true },
      (callbackUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!callbackUrl) {
          reject(new Error("登录已取消。"));
          return;
        }
        resolve(callbackUrl);
      },
    );
  });

  const ticket = extractTicketFromRedirect(responseUrl);
  if (!ticket) {
    throw new Error("登录回调缺少 ticket，请重试。");
  }

  try {
    return await exchangeTicket(ticket, verifier, options);
  } finally {
    await removeLocal(PKCE_VERIFIER_KEY);
  }
}

export async function logoutDogeow(options = {}) {
  const auth = await getDogeowAuth();
  if (auth?.token) {
    try {
      await apiRequest("/api/logout", {
        method: "POST",
        token: auth.token,
        fetchImpl: options.fetchImpl,
      });
    } catch (_) {
      // 本地清理优先
    }
  }
  await clearDogeowAuth();
}

export async function dogeowAuthedRequest(path, options = {}) {
  const auth = await getDogeowAuth();
  if (!isDogeowLoggedIn(auth)) {
    throw new Error("请先登录 DogeOW 账号。");
  }
  try {
    return await apiRequest(path, {
      method: options.method || "GET",
      body: options.body,
      token: auth.token,
      fetchImpl: options.fetchImpl,
    });
  } catch (error) {
    if (error?.status === 401) {
      await clearDogeowAuth();
      throw new Error("DogeOW 登录已过期，请重新登录。");
    }
    throw error;
  }
}
