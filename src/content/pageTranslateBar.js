/**
 * 页面翻译浮动控制条
 * 提供 原文 / 译文 / 双语 切换按钮、模型下载进度条、停止按钮。
 */

const BAR_ID = "ollama-pt-bar";

const MODE_OPTIONS = [
  { value: "translation", label: "译文" },
  { value: "original", label: "原文" },
  { value: "bilingual", label: "双语" },
];

export function createPageTranslateBar(pageTranslator) {
  let barElement = null;
  let modeRow = null;
  let progressRow = null;
  let progressBar = null;
  let progressLabel = null;
  let unsubscribeMode = null;
  let progressHideTimer = null;

  function ensureBar() {
    if (barElement && barElement.isConnected) return barElement;
    barElement = document.createElement("div");
    barElement.id = BAR_ID;
    barElement.setAttribute("aria-label", "页面翻译控制");
    barElement.addEventListener("mousedown", (e) => e.stopPropagation());

    modeRow = document.createElement("div");
    modeRow.className = "ollama-pt-bar-row";

    MODE_OPTIONS.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ollama-pt-bar-btn";
      btn.dataset.mode = option.value;
      btn.textContent = option.label;
      btn.addEventListener("click", () => {
        pageTranslator.setDisplayMode?.(option.value);
      });
      modeRow.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "ollama-pt-bar-divider";
    modeRow.appendChild(divider);

    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "ollama-pt-bar-btn ollama-pt-bar-stop";
    stopBtn.textContent = "停止";
    stopBtn.addEventListener("click", () => {
      pageTranslator.stop?.();
    });
    modeRow.appendChild(stopBtn);
    barElement.appendChild(modeRow);

    progressRow = document.createElement("div");
    progressRow.className = "ollama-pt-bar-progress-row";
    progressRow.hidden = true;

    progressLabel = document.createElement("div");
    progressLabel.className = "ollama-pt-bar-progress-label";
    progressRow.appendChild(progressLabel);

    const track = document.createElement("div");
    track.className = "ollama-pt-bar-progress-track";
    progressBar = document.createElement("div");
    progressBar.className = "ollama-pt-bar-progress-bar";
    track.appendChild(progressBar);
    progressRow.appendChild(track);

    barElement.appendChild(progressRow);

    document.documentElement.appendChild(barElement);
    return barElement;
  }

  function syncActiveMode(mode) {
    if (!barElement) return;
    barElement
      .querySelectorAll(".ollama-pt-bar-btn[data-mode]")
      .forEach((btn) => {
        if (btn.dataset.mode === mode) {
          btn.classList.add("ollama-pt-bar-btn--active");
        } else {
          btn.classList.remove("ollama-pt-bar-btn--active");
        }
      });
  }

  function setDownloadProgress(loaded) {
    if (!barElement) return;
    if (progressHideTimer) {
      clearTimeout(progressHideTimer);
      progressHideTimer = null;
    }
    const pct = Math.max(0, Math.min(1, Number(loaded) || 0));
    progressRow.hidden = false;
    progressLabel.textContent = `下载语言模型 ${Math.round(pct * 100)}%`;
    progressBar.style.width = `${Math.round(pct * 100)}%`;
    if (pct >= 1) {
      progressLabel.textContent = "语言模型下载完成";
      progressHideTimer = setTimeout(() => {
        if (progressRow) progressRow.hidden = true;
      }, 1500);
    }
  }

  function clearDownloadProgress() {
    if (progressHideTimer) {
      clearTimeout(progressHideTimer);
      progressHideTimer = null;
    }
    if (progressRow) progressRow.hidden = true;
    if (progressBar) progressBar.style.width = "0%";
  }

  function show() {
    ensureBar();
    syncActiveMode(pageTranslator.getDisplayMode?.() || "translation");
    if (!unsubscribeMode && typeof pageTranslator.onDisplayModeChange === "function") {
      unsubscribeMode = pageTranslator.onDisplayModeChange(syncActiveMode);
    }
  }

  function hide() {
    if (unsubscribeMode) {
      unsubscribeMode();
      unsubscribeMode = null;
    }
    clearDownloadProgress();
    if (barElement && barElement.isConnected) {
      barElement.remove();
    }
    barElement = null;
    modeRow = null;
    progressRow = null;
    progressBar = null;
    progressLabel = null;
  }

  return { show, hide, setDownloadProgress, clearDownloadProgress };
}
