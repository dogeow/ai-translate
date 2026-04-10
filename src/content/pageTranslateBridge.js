import { createVisualPageTranslator } from "./pageTranslate.js";

const PAGE_TRANSLATE_CHUNK_TIMEOUT_MS = 30000;
const PAGE_TRANSLATE_BATCH_TIMEOUT_MS = 45000;

function createRequest(sendMessageSafe, action, payloadKey, timeoutMs, triggerSource) {
  return (value) =>
    new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(payload);
      };
      const timer = window.setTimeout(() => {
        finish({ ok: false, error: "timeout" });
      }, timeoutMs);

      sendMessageSafe(
        {
          action,
          [payloadKey]: value,
          triggerSource,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            finish({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          finish(response || { ok: false, error: "empty_response" });
        },
      );
    });
}

export function createPageTranslateBridge({
  sendMessageSafe,
  showShortcutHint,
  shouldSkipText,
  isUiElement,
  initialOptions,
}) {
  return createVisualPageTranslator({
    requestChunkTranslation: createRequest(
      sendMessageSafe,
      "translatePageTextChunk",
      "text",
      PAGE_TRANSLATE_CHUNK_TIMEOUT_MS,
      "page-visual",
    ),
    requestBatchTranslation: createRequest(
      sendMessageSafe,
      "translatePageTextBatch",
      "texts",
      PAGE_TRANSLATE_BATCH_TIMEOUT_MS,
      "page-visual-batch",
    ),
    onStatusMessage: (message) => showShortcutHint(message),
    shouldSkipText,
    isUiElement,
    initialOptions,
  });
}
