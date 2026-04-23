import {
  createContextMenus,
  MENU_TRANSLATE_SELECTION,
  MENU_TRANSLATE_PAGE,
  MENU_OPEN_OPTIONS,
  MENU_AUTO_MODE_HOTKEY,
  MENU_AUTO_MODE_SELECTION,
  MENU_AUTO_MODE_HOVER,
  MENU_HOVER_SCOPE_WORD,
  MENU_HOVER_SCOPE_PARAGRAPH,
} from "./shared/utils/contextMenu.js";
import {
  sendTranslateResult,
  openResultWindow,
  triggerVisualPageTranslate,
} from "./shared/utils/messaging.js";
import {
  readStoredUpdateState,
  ensureUpdateCheckAlarm,
  checkForExtensionUpdate,
  UPDATE_CHECK_ALARM_NAME,
} from "./shared/utils/updateManager.js";
import { isRateLimitError } from "./shared/utils/textProcessing.js";
import { migrateSettingsIfNeeded } from "./shared/settings.js";
import {
  translatePageBatchWithProvider,
  translateWithProvider,
} from "./background/translationService.js";

const LOG_PREFIX = "[Ollama 翻译]";

async function initializeExtensionRuntime() {
  const migration = await migrateSettingsIfNeeded(
    () => chrome.storage.sync.get(null),
    (updates) => chrome.storage.sync.set(updates),
  );
  if (!migration.shouldMigrate || migration.writeFailed) {
    await createContextMenus();
  }
  void ensureUpdateCheckAlarm();
  void checkForExtensionUpdate();
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtensionRuntime();
});

chrome.runtime.onStartup?.addListener(() => {
  void initializeExtensionRuntime();
});

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_CHECK_ALARM_NAME) return;
  void checkForExtensionUpdate();
});

chrome.commands.onCommand.addListener(async (command) => {
  console.log(LOG_PREFIX, "command received:", command);
  if (command !== "translate-selection") return;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) {
    console.warn(LOG_PREFIX, "no active tab id");
    return;
  }

  try {
    let text = "";
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "getTextToTranslate" },
        (value) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(value);
        },
      );
    });
    if (response && (response.text || "").trim()) {
      text = response.text.trim();
    }
    if (!text) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection();
          return selection && selection.toString().trim();
        },
      });
      text = (results[0]?.result || "").trim();
    }
    if (!text) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: "showShortcutHint",
          message: "请选中文字或将鼠标悬停在单词上",
        });
      } catch (e) {
        console.warn(LOG_PREFIX, "send showShortcutHint failed:", e?.message);
      }
      return;
    }

    const result = await translateWithProvider(text, tab.id, {
      showPending: true,
    });
    if (!result) return;
    const sent = await sendTranslateResult(tab.id, result);
    if (!sent) {
      openResultWindow();
    }
  } catch (e) {
    console.error(LOG_PREFIX, "Hotkey translate error:", e);
  }
});

const AUTO_MODE_MENU_MAP = {
  [MENU_AUTO_MODE_HOTKEY]: { key: "autoTranslateMode", value: "hotkey" },
  [MENU_AUTO_MODE_SELECTION]: {
    key: "autoTranslateMode",
    value: "selection",
  },
  [MENU_AUTO_MODE_HOVER]: { key: "autoTranslateMode", value: "hover" },
  [MENU_HOVER_SCOPE_WORD]: { key: "hoverTranslateScope", value: "word" },
  [MENU_HOVER_SCOPE_PARAGRAPH]: {
    key: "hoverTranslateScope",
    value: "paragraph",
  },
};

chrome.contextMenus.onClicked.addListener(async (info, clickedTab) => {
  const menuConfig = AUTO_MODE_MENU_MAP[info.menuItemId];
  if (menuConfig) {
    await chrome.storage.sync.set({ [menuConfig.key]: menuConfig.value });
    return;
  }

  if (info.menuItemId === MENU_OPEN_OPTIONS) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  const clickedTabId = clickedTab?.id;
  if (info.menuItemId === MENU_TRANSLATE_PAGE) {
    const response = await triggerVisualPageTranslate(clickedTabId);
    if (!response?.ok) {
      console.warn(
        LOG_PREFIX,
        "右键菜单触发页面翻译失败:",
        response?.error || "unknown_error",
      );
    }
    return;
  }

  if (info.menuItemId !== MENU_TRANSLATE_SELECTION || !info.selectionText) {
    return;
  }

  const text = info.selectionText.trim();
  let tabId = clickedTabId;
  if (!tabId) {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabId = tab?.id;
  }
  try {
    const result = await translateWithProvider(text, tabId, {
      showPending: true,
    });
    if (!result) return;
    if (tabId) {
      const sent = await sendTranslateResult(tabId, result);
      if (sent) return;
    }
    openResultWindow();
  } catch (_) {}
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (
    !("autoTranslateMode" in changes) &&
    !("ollamaAutoTranslateMode" in changes) &&
    !("ollamaAutoTranslateSelection" in changes) &&
    !("hoverTranslateScope" in changes) &&
    !("ollamaHoverTranslateScope" in changes) &&
    !("appEnabled" in changes)
  ) {
    return;
  }
  void createContextMenus();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getExtensionUpdateState") {
    readStoredUpdateState()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg.action === "checkExtensionUpdate") {
    checkForExtensionUpdate({ markChecking: true })
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg.action === "translatePageTextBatch" && Array.isArray(msg.texts)) {
    translatePageBatchWithProvider(msg.texts)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || String(error),
        }),
      );
    return true;
  }

  if (msg.action === "translatePageTextChunk" && msg.text) {
    const chunkText = String(msg.text).trim();
    if (!chunkText) {
      sendResponse({ ok: false, error: "empty_text" });
      return true;
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
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg.action !== "translate" || !msg.text) return true;

  const text = String(msg.text).trim();
  const tabId = sender.tab?.id;
  const fromTip = msg.fromTip;
  const requestId = msg.requestId;
  const triggerSource = msg.triggerSource;

  translateWithProvider(text, tabId, {
    showPending: !fromTip,
    requestId,
    triggerSource,
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

      if (tabId) {
        sendTranslateResult(tabId, { ...result, fromTip }).then(
          (sent) => {
            if (!sent) {
              openResultWindow();
            }
            sendResponse(responsePayload);
          },
          () => sendResponse(responsePayload),
        );
      } else {
        openResultWindow();
        sendResponse(responsePayload);
      }
    })
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
