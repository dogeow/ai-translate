/**
 * Content script 入口
 * 仅负责实例生命周期管理。
 */
import { initContentRuntime, logDebug } from "./content/runtime.js";

const CONTENT_STATE_KEY = "__OLLAMA_TRANSLATE_CONTENT_STATE__";

export default function main() {
  logDebug("Content script 初始化开始...");
  const prevState = globalThis[CONTENT_STATE_KEY];
  if (prevState && typeof prevState.cleanup === "function") {
    try {
      logDebug("清理旧实例...");
      prevState.cleanup();
    } catch (e) {
      logDebug("清理旧实例失败:", e.message);
    }
  }

  logDebug("初始化新实例...");
  const cleanup = initContentRuntime();
  globalThis[CONTENT_STATE_KEY] = {
    cleanup,
  };
  logDebug("Content script 初始化完成！");

  return () => {
    try {
      if (typeof cleanup === "function") {
        logDebug("执行 cleanup...");
        cleanup();
      }
    } finally {
      if (globalThis[CONTENT_STATE_KEY]?.cleanup === cleanup) {
        delete globalThis[CONTENT_STATE_KEY];
      }
    }
  };
}
