import { translatePageBatchWithProvider } from "./pageTranslationService.js";
import { translateWithProvider } from "./translationService.js";
import {
  openResultWindow,
  sendTranslateResult,
} from "../shared/utils/messaging.js";
import { isRateLimitError } from "../shared/utils/textProcessing.js";

const TRANSLATION_MESSAGE_ACTIONS = new Set([
  "translate",
  "translatePageTextBatch",
  "translatePageTextChunk",
]);

function sendChromeAiDownloadProgress(tabId, loaded) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(
      tabId,
      { action: "chromeAiDownloadProgress", loaded },
      () => {
        void chrome.runtime.lastError;
      },
    );
  } catch (_) {}
}

function handlePageBatchMessage(msg, sender, sendResponse) {
  if (!Array.isArray(msg.texts)) {
    sendResponse({ ok: false, error: "empty_texts" });
    return;
  }

  const tabId = sender.tab?.id;
  translatePageBatchWithProvider(msg.texts, {
    onDownloadProgress: (loaded) =>
      sendChromeAiDownloadProgress(tabId, loaded),
  })
    .then((result) => sendResponse(result))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error.message || String(error),
      }),
    );
}

function handlePageChunkMessage(msg, sendResponse) {
  const chunkText = String(msg.text || "").trim();
  if (!chunkText) {
    sendResponse({ ok: false, error: "empty_text" });
    return;
  }

  translateWithProvider(chunkText, null, {
    showPending: false,
    requestId: msg.requestId,
    triggerSource: msg.triggerSource || "page-visual",
    persistResult: false,
    learningModeOverride: false,
  })
    .then((result) => {
      if (!result) {
        sendResponse({ ok: false, disabled: true });
        return;
      }
      sendResponse({
        ok: !result.error && !!result.translation,
        translation: result.translation || "",
        error: result.error || null,
        rateLimited: isRateLimitError(result.error),
        needModel: !!result.needModel,
      });
    })
    .catch((error) =>
      sendResponse({ ok: false, error: error.message || String(error) }),
    );
}

function handleSingleTranslationMessage(msg, sender, sendResponse) {
  const text = String(msg.text || "").trim();
  if (!text) {
    sendResponse({ ok: false, error: "empty_text" });
    return;
  }

  const tabId = sender.tab?.id;
  const fromTip = msg.fromTip;
  translateWithProvider(text, tabId, {
    showPending: !fromTip,
    requestId: msg.requestId,
    triggerSource: msg.triggerSource,
  })
    .then((result) => {
      if (!result) {
        sendResponse({ ok: true, disabled: true });
        return;
      }
      const responsePayload = {
        ok: !result.error && !result.needModel,
        needModel: result.needModel,
        error: result.error,
      };

      if (!tabId) {
        openResultWindow();
        sendResponse(responsePayload);
        return;
      }

      sendTranslateResult(tabId, { ...result, fromTip }).then(
        (sent) => {
          if (!sent) openResultWindow();
          sendResponse(responsePayload);
        },
        () => sendResponse(responsePayload),
      );
    })
    .catch((error) =>
      sendResponse({ ok: false, error: error.message || String(error) }),
    );
}

export function handleTranslationRuntimeMessage(msg, sender, sendResponse) {
  if (!msg || !TRANSLATION_MESSAGE_ACTIONS.has(msg.action)) {
    return false;
  }

  if (msg.action === "translatePageTextBatch") {
    handlePageBatchMessage(msg, sender, sendResponse);
  } else if (msg.action === "translatePageTextChunk") {
    handlePageChunkMessage(msg, sendResponse);
  } else {
    handleSingleTranslationMessage(msg, sender, sendResponse);
  }

  return true;
}
