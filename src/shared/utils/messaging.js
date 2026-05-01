/**
 * Message communication and result management utilities
 */

import { TRANSLATE_RESULT_KEY } from "../constants.js";

/**
 * Send translate pending message to content script
 * @param {number} tabId - Tab ID
 * @param {object} payload - Pending translation payload
 * @returns {Promise<boolean>}
 */
export async function sendTranslatePending(tabId, payload) {
  if (!tabId) return false;
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "showTranslatePending",
      ...payload,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build pending translation payload
 * @param {object} params - Translation parameters
 * @returns {object} Pending translation payload
 */
export function buildPendingTranslatePayload({
  text,
  targetLang,
  model,
  learningModeEnabled,
  requestId,
  triggerSource,
  translation = null,
  thinking = null,
  sentenceStudyThinking = null,
  sentenceStudyPending = false,
  downloadProgress = null,
}) {
  return {
    original: text,
    targetLang,
    model,
    learningModeEnabled,
    requestId,
    triggerSource,
    translation,
    thinking,
    sentenceStudyThinking,
    sentenceStudyPending,
    downloadProgress,
  };
}

/**
 * Send translate result to content script
 * @param {number} tabId - Tab ID
 * @param {object} payload - Translation result payload
 * @param {string} action - Action name (default: "showTranslateResult")
 * @returns {Promise<boolean>}
 */
export async function sendTranslateResult(
  tabId,
  payload,
  action = "showTranslateResult",
) {
  if (!tabId) return false;
  try {
    await chrome.tabs.sendMessage(tabId, {
      action,
      ...payload,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist translation result to local storage
 * @param {object} result - Translation result
 * @returns {Promise<void>}
 */
export async function persistTranslateResult(result) {
  await chrome.storage.local.set({
    [TRANSLATE_RESULT_KEY]: result,
  });
}

/**
 * Create a unique translation request ID
 * @param {string} requestId - Existing request ID (optional)
 * @returns {string} Request ID
 */
export function createTranslateRequestId(requestId) {
  if (requestId) return requestId;
  return `translate:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build translation error result
 * @param {object} params - Error parameters
 * @returns {object} Error result
 */
export function buildErrorResult({
  original,
  targetLang,
  error,
  model = null,
  models = null,
  needModel = false,
  learningModeEnabled,
  requestId,
  triggerSource,
}) {
  return {
    original,
    translation: null,
    error,
    targetLang,
    model,
    ...(models && { models }),
    needModel,
    learningModeEnabled,
    sentenceStudy: null,
    sentenceStudyThinking: null,
    sentenceStudyPending: false,
    requestId,
    triggerSource,
  };
}

/**
 * Open translation result in a popup window
 * @returns {void}
 */
export function openResultWindow() {
  const resultUrl = chrome.runtime.getURL("options/index.html#translate");
  chrome.windows.create({
    url: resultUrl,
    type: "popup",
    width: 480,
    height: 360,
  });
}

/**
 * Trigger visual page translation in content script
 * @param {number} tabId - Tab ID
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function triggerVisualPageTranslate(tabId) {
  if (!tabId) return { ok: false, error: "missing_tab" };

  try {
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "startVisualPageTranslate" },
        (value) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          resolve(value || { ok: true });
        },
      );
    });

    return response;
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}
