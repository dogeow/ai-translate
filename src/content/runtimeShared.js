const LOG_PREFIX = "[Ollama 翻译-Content]";

export function logDebug(...args) {
  console.log(LOG_PREFIX, ...args);
}

export function sendMessageSafe(msg, callback) {
  try {
    chrome.runtime.sendMessage(msg, callback);
  } catch (e) {
    logDebug("sendMessage 失败:", e.message, "msg:", msg.action);
    if (e.message && e.message.includes("Extension context invalidated")) {
      logDebug("检测到 Extension context 失效，需要刷新页面以重新连接扩展");
    }
    if (callback) {
      callback();
    }
  }
}

export function createChineseTextGuards() {
  const HAN_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
  const SIGNIFICANT_CHAR_RE = /[\p{L}\p{N}]/u;

  function isMostlyChineseText(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    const significantChars = Array.from(value).filter((char) =>
      SIGNIFICANT_CHAR_RE.test(char),
    );
    if (significantChars.length === 0) return false;

    let hanCount = 0;
    for (const char of significantChars) {
      if (HAN_CHAR_RE.test(char)) {
        hanCount += 1;
      }
    }

    if (hanCount === 0) return false;
    if (significantChars.length <= 4 && hanCount === significantChars.length) {
      return true;
    }

    return hanCount / significantChars.length >= 0.6;
  }

  function isChineseIdentifierText(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    if (!HAN_CHAR_RE.test(value)) return false;
    if (!/\d/.test(value)) return false;
    if (!/^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\dA-Za-z\-·.]+$/.test(value))
      return false;
    const digits = value.match(/\d/g) || [];
    return digits.length / value.length >= 0.3;
  }

  return {
    isMostlyChineseText,
    isChineseIdentifierText,
  };
}
