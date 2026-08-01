const LOG_PREFIX = "[英语学习和AI翻译-Content]";

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
