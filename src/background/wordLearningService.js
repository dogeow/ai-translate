/**
 * 英语学习 - background 处理
 * 提供：单词查询（有道 / AI）+ 单词增删改 + 复习状态变更 + 右键菜单
 */
import { lookupWordCached } from "./wordLookupService.js";
import {
  addKnownWord,
  removeKnownWord,
  addStudyingWord,
  removeStudyingWord,
  reviewStudyingWord,
  loadAllWords,
  loadKnownWords,
  loadStudyingWords,
  saveAllWords,
  getWordLearningStatus,
  setWordLearningStatus,
} from "../shared/word-learning.js";
import {
  mergeWordLearningData,
  parseWordLearningImport,
} from "../shared/word-learning-transfer.js";
import {
  beginDogeowSsoLogin,
  getDogeowAuthSummary,
  logoutDogeow,
} from "../shared/dogeow-auth.js";
import {
  getWordSyncMeta,
  syncWordsWithCloud,
} from "../shared/dogeow-word-sync.js";

export { lookupWordCached } from "./wordLookupService.js";

let cloudSyncTimer = null;
let cloudSyncInFlight = null;

async function scheduleCloudWordSync() {
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    void maybeSyncWordsToCloud();
  }, 1500);
}

async function maybeSyncWordsToCloud() {
  const summary = await getDogeowAuthSummary({ skipProfile: true });
  if (!summary.isLoggedIn) return null;
  if (cloudSyncInFlight) return cloudSyncInFlight;
  cloudSyncInFlight = syncWordsWithCloud()
    .catch((error) => {
      console.warn("[ai-translate] cloud word sync failed:", error);
      return null;
    })
    .finally(() => {
      cloudSyncInFlight = null;
    });
  return cloudSyncInFlight;
}

async function broadcastWordsChanged(change = {}) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab?.id) continue;
      try {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "wordsChanged", ...change },
          () => {
            void chrome.runtime.lastError;
          },
        );
      } catch (_) {}
    }
  } catch (_) {}
}

const IMPORT_ERROR_MESSAGES = {
  empty_file: "导入文件是空的。",
  invalid_file: "无法识别这个导入文件。",
  unsupported_format: "这个导入文件的版本暂不支持。",
  too_many_words: "单次最多导入 20000 个单词。",
  no_valid_words: "文件中没有可导入的英文单词。",
};

export async function handleWordLearningMessage(msg) {
  if (msg.action === "lookupWord") {
    return await lookupWordCached(msg.word);
  }
  if (msg.action === "getAllWords") {
    const data = await loadAllWords();
    return { ok: true, ...data };
  }
  if (msg.action === "getKnownWords") {
    const known = await loadKnownWords();
    return { ok: true, words: known };
  }
  if (msg.action === "getStudyingWords") {
    const studying = await loadStudyingWords();
    return { ok: true, words: studying };
  }
  if (msg.action === "importWordLearningData") {
    try {
      const current = await loadAllWords();
      const imported = parseWordLearningImport(msg.data);
      const merged = mergeWordLearningData(current, imported);
      if (merged.addedKnown > 0 || merged.addedStudying > 0) {
        await saveAllWords(merged);
        await broadcastWordsChanged();
        void scheduleCloudWordSync();
      }
      return {
        ok: true,
        addedKnown: merged.addedKnown,
        addedStudying: merged.addedStudying,
        skipped: merged.skipped,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          IMPORT_ERROR_MESSAGES[error?.message] || "导入失败，请检查文件内容。",
      };
    }
  }
  if (msg.action === "getWordLearningStatus") {
    const result = await getWordLearningStatus(msg.word);
    return result
      ? { ok: true, ...result }
      : { ok: false, error: "无效的单词。" };
  }
  if (msg.action === "setWordLearningStatus") {
    const result = await setWordLearningStatus(msg.word, msg.status);
    if (result) {
      await broadcastWordsChanged(result);
      void scheduleCloudWordSync();
    }
    return result
      ? { ok: true, ...result }
      : { ok: false, error: "无效的单词状态。" };
  }
  if (msg.action === "addKnownWord") {
    const word = await addKnownWord(msg.word);
    if (word) {
      await broadcastWordsChanged({ word, status: "known" });
      void scheduleCloudWordSync();
    }
    return { ok: !!word, word };
  }
  if (msg.action === "removeKnownWord") {
    const ok = await removeKnownWord(msg.word);
    if (ok) {
      await broadcastWordsChanged({ word: msg.word, status: "unmarked" });
      void scheduleCloudWordSync();
    }
    return { ok };
  }
  if (msg.action === "addStudyingWord") {
    const word = await addStudyingWord(msg.word);
    if (word) {
      await broadcastWordsChanged({ word, status: "studying" });
      void scheduleCloudWordSync();
    }
    return { ok: !!word, word };
  }
  if (msg.action === "removeStudyingWord") {
    const ok = await removeStudyingWord(msg.word);
    if (ok) {
      await broadcastWordsChanged({ word: msg.word, status: "unmarked" });
      void scheduleCloudWordSync();
    }
    return { ok };
  }
  if (msg.action === "reviewWord") {
    const entry = await reviewStudyingWord(msg.word, msg.reviewAction);
    if (entry) {
      await broadcastWordsChanged({
        word: msg.word,
        status: "studying",
        entry,
      });
      void scheduleCloudWordSync();
    }
    return { ok: !!entry, entry };
  }

  if (msg.action === "dogeowGetAuth") {
    const summary = await getDogeowAuthSummary();
    const meta = await getWordSyncMeta();
    return { ok: true, ...summary, syncMeta: meta };
  }
  if (msg.action === "dogeowLogin") {
    try {
      const auth = await beginDogeowSsoLogin();
      const summary = await getDogeowAuthSummary({ skipProfile: true });
      // 登录后立刻做一次双向同步
      const syncResult = await syncWordsWithCloud().catch((error) => ({
        error: error?.message || String(error),
      }));
      if (syncResult && !syncResult.error) {
        await broadcastWordsChanged();
      }
      return {
        ok: true,
        auth,
        user: summary.user,
        sync: syncResult,
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "DogeOW 登录失败。",
      };
    }
  }
  if (msg.action === "dogeowLogout") {
    await logoutDogeow();
    return { ok: true };
  }
  if (msg.action === "dogeowSyncWords") {
    try {
      const result = await syncWordsWithCloud();
      await broadcastWordsChanged();
      return { ok: true, ...result };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "云端同步失败。",
      };
    }
  }

  return null;
}
