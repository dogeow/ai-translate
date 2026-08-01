import { useState } from "react";
import { ShortcutsList } from "./ShortcutsList.jsx";
import { SHORTCUTS_URL } from "../../shared/constants.js";
import { tabsCreate } from "../lib/chrome.js";

export function ShortcutsTab({ shortcuts }) {
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);

  async function openShortcutsPage() {
    try {
      await tabsCreate(SHORTCUTS_URL);
      setShowShortcutsHint(false);
    } catch (_) {
      setShowShortcutsHint(true);
    }
  }

  return (
    <>
      <div className="card shortcuts-card">
        <h2>快捷键</h2>
        <p className="shortcuts-desc">
          翻译、页面显示和各项模式开关都可以绑定快捷键。显示“未设置”的命令，需要先在浏览器中绑定按键。
        </p>

        <ShortcutsList
          commands={shortcuts}
          supportsCommands={!!chrome.commands?.getAll}
        />
        <div className="shortcuts-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openShortcutsPage}
          >
            打开浏览器快捷键设置
          </button>
          {showShortcutsHint ? (
            <span className="hint shortcuts-open-hint">
              若无法自动打开，请手动打开：扩展程序 → 键盘快捷方式（Chrome
              地址栏输入 <code>{SHORTCUTS_URL}</code>）
            </span>
          ) : null}
        </div>
      </div>
      <p className="shortcuts-hint">
        模式切换后会在当前页面显示结果提示；生词标记、认词模式和学习模式的状态会与弹窗及设置页同步。
      </p>
    </>
  );
}
