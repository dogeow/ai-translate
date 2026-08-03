/**
 * 页面翻译浮动控制条
 * 提供 原文 / 译文 / 双语 切换按钮、模型下载进度条、停止按钮。
 */

import { getArticleNarrationRateOptions } from "./articleNarration.js";

const BAR_ID = "ollama-pt-bar";

const MODE_OPTIONS = [
  { value: "translation", label: "译文" },
  { value: "original", label: "原文" },
  { value: "bilingual", label: "双语" },
];

const NARRATION_MODE_OPTIONS = [
  { value: "original", label: "原文" },
  { value: "translation", label: "译文" },
  { value: "bilingual", label: "双语" },
];

const NARRATION_ACCENT_OPTIONS = [
  { value: "us", label: "自然美音" },
  { value: "uk", label: "自然英音" },
];

const NARRATION_RATE_OPTIONS = getArticleNarrationRateOptions();

export function createPageTranslateBar(pageTranslator, articleNarrator = null) {
  let barElement = null;
  let modeRow = null;
  let narrationRow = null;
  let narrationLabel = null;
  let narrationPauseButton = null;
  let narrationOptionsRow = null;
  let narrationModeSelect = null;
  let narrationAccentSelect = null;
  let narrationRateSelect = null;
  let recognitionRow = null;
  let recognitionLabel = null;
  let progressRow = null;
  let progressBar = null;
  let progressLabel = null;
  let unsubscribeMode = null;
  let unsubscribeNarration = null;
  let progressHideTimer = null;
  let translationControlsVisible = false;
  let recognitionStats = null;
  let narrationState = articleNarrator?.getState?.() || { status: "idle" };

  function resetBarReferences() {
    barElement = null;
    modeRow = null;
    narrationRow = null;
    narrationLabel = null;
    narrationPauseButton = null;
    narrationOptionsRow = null;
    narrationModeSelect = null;
    narrationAccentSelect = null;
    narrationRateSelect = null;
    recognitionRow = null;
    recognitionLabel = null;
    progressRow = null;
    progressBar = null;
    progressLabel = null;
  }

  function syncLayoutMode() {
    if (!barElement) return;
    barElement.classList.toggle(
      "ollama-pt-bar--recognition-only",
      !!recognitionStats &&
        !translationControlsVisible &&
        narrationState.status === "idle",
    );
  }

  function isNarrationVisible() {
    return narrationState.status && narrationState.status !== "idle";
  }

  function createNarrationSelect(className, label, options, onChange) {
    const select = document.createElement("select");
    select.className = `ollama-pt-bar-select ${className}`;
    select.setAttribute("aria-label", label);
    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    });
    select.addEventListener("change", onChange);
    return select;
  }

  function syncNarrationState() {
    if (!narrationRow || !narrationOptionsRow) return;
    const visible = isNarrationVisible();
    narrationRow.hidden = !visible;
    narrationOptionsRow.hidden = !visible;
    if (!visible) return;

    const isError = narrationState.status === "error";
    const progress = `文章朗读 ${narrationState.sectionIndex || 0} / ${narrationState.totalSections || 0}`;
    const currentWord = String(narrationState.currentWord || "").trim();
    narrationLabel.textContent = isError
      ? narrationState.error || "朗读失败，请重试"
      : currentWord
        ? `${progress} · ${currentWord}`
        : progress;
    narrationLabel.title = narrationLabel.textContent;
    narrationPauseButton.hidden = isError;
    narrationPauseButton.textContent =
      narrationState.status === "paused" ? "继续" : "暂停";
    narrationModeSelect.value = narrationState.mode || "original";
    narrationAccentSelect.value = narrationState.accent || "us";
    narrationRateSelect.value = String(narrationState.rate || 1);
  }

  function syncRecognitionStats() {
    if (!recognitionRow || !recognitionLabel || !recognitionStats) return;
    const knownCount = Math.max(
      0,
      Number(recognitionStats.knownCount) || 0,
    );
    const totalCount = Math.max(
      0,
      Number(recognitionStats.totalCount) || 0,
    );
    const percentage = Math.max(
      0,
      Math.min(100, Number(recognitionStats.percentage) || 0),
    );
    recognitionLabel.textContent = `认词率 ${Math.round(percentage)}%`;
    recognitionLabel.title = `本页熟词 ${knownCount} / ${totalCount}（按英文单词出现次数统计）`;
    recognitionRow.hidden = false;
  }

  function ensureBar() {
    if (barElement && barElement.isConnected) return barElement;
    barElement = document.createElement("div");
    barElement.id = BAR_ID;
    barElement.setAttribute("aria-label", "页面翻译与认词控制");
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

    narrationRow = document.createElement("div");
    narrationRow.className =
      "ollama-pt-bar-row ollama-pt-bar-narration-row";
    narrationRow.hidden = true;

    narrationLabel = document.createElement("div");
    narrationLabel.className = "ollama-pt-bar-narration-label";
    narrationLabel.setAttribute("aria-live", "polite");
    narrationRow.appendChild(narrationLabel);

    narrationPauseButton = document.createElement("button");
    narrationPauseButton.type = "button";
    narrationPauseButton.className = "ollama-pt-bar-btn";
    narrationPauseButton.dataset.action = "narration-pause";
    narrationPauseButton.addEventListener("click", () => {
      articleNarrator?.togglePause?.();
    });
    narrationRow.appendChild(narrationPauseButton);

    const narrationStopButton = document.createElement("button");
    narrationStopButton.type = "button";
    narrationStopButton.className =
      "ollama-pt-bar-btn ollama-pt-bar-stop";
    narrationStopButton.dataset.action = "narration-stop";
    narrationStopButton.textContent = "停止";
    narrationStopButton.addEventListener("click", () => {
      articleNarrator?.stop?.();
    });
    narrationRow.appendChild(narrationStopButton);
    barElement.appendChild(narrationRow);

    narrationOptionsRow = document.createElement("div");
    narrationOptionsRow.className =
      "ollama-pt-bar-row ollama-pt-bar-narration-options";
    narrationOptionsRow.hidden = true;

    narrationModeSelect = createNarrationSelect(
      "ollama-pt-bar-narration-mode",
      "朗读内容",
      NARRATION_MODE_OPTIONS,
      () => articleNarrator?.setOptions?.({ mode: narrationModeSelect.value }),
    );
    narrationOptionsRow.appendChild(narrationModeSelect);

    narrationAccentSelect = createNarrationSelect(
      "ollama-pt-bar-narration-accent",
      "英文发音",
      NARRATION_ACCENT_OPTIONS,
      () => articleNarrator?.setOptions?.({ accent: narrationAccentSelect.value }),
    );
    narrationOptionsRow.appendChild(narrationAccentSelect);

    narrationRateSelect = createNarrationSelect(
      "ollama-pt-bar-narration-rate",
      "朗读速度",
      NARRATION_RATE_OPTIONS,
      () => articleNarrator?.setOptions?.({ rate: Number(narrationRateSelect.value) }),
    );
    narrationOptionsRow.appendChild(narrationRateSelect);
    barElement.appendChild(narrationOptionsRow);

    recognitionRow = document.createElement("div");
    recognitionRow.className =
      "ollama-pt-bar-row ollama-pt-bar-recognition-row";
    recognitionRow.hidden = true;

    recognitionLabel = document.createElement("div");
    recognitionLabel.className = "ollama-pt-bar-recognition-label";
    recognitionLabel.setAttribute("aria-live", "polite");
    recognitionRow.appendChild(recognitionLabel);
    barElement.appendChild(recognitionRow);

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
    modeRow.hidden = !translationControlsVisible;
    if (recognitionStats) syncRecognitionStats();
    syncNarrationState();
    syncLayoutMode();
    return barElement;
  }

  function removeBarIfUnused() {
    if (translationControlsVisible || recognitionStats || isNarrationVisible()) return;
    if (barElement?.isConnected) barElement.remove();
    resetBarReferences();
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
    translationControlsVisible = true;
    ensureBar();
    modeRow.hidden = false;
    syncLayoutMode();
    syncActiveMode(pageTranslator.getDisplayMode?.() || "translation");
    if (!unsubscribeMode && typeof pageTranslator.onDisplayModeChange === "function") {
      unsubscribeMode = pageTranslator.onDisplayModeChange(syncActiveMode);
    }
  }

  function hide() {
    translationControlsVisible = false;
    if (unsubscribeMode) {
      unsubscribeMode();
      unsubscribeMode = null;
    }
    clearDownloadProgress();
    if (modeRow) modeRow.hidden = true;
    syncLayoutMode();
    removeBarIfUnused();
  }

  function setRecognitionStats(stats) {
    recognitionStats = stats && typeof stats === "object" ? stats : null;
    if (!recognitionStats) {
      if (recognitionRow) recognitionRow.hidden = true;
      removeBarIfUnused();
      return;
    }
    ensureBar();
    syncRecognitionStats();
    syncLayoutMode();
  }

  function onNarrationStateChange(nextState) {
    narrationState = nextState || { status: "idle" };
    if (isNarrationVisible()) {
      ensureBar();
      syncNarrationState();
      syncLayoutMode();
      return;
    }
    if (narrationRow) narrationRow.hidden = true;
    if (narrationOptionsRow) narrationOptionsRow.hidden = true;
    syncLayoutMode();
    removeBarIfUnused();
  }

  function destroy() {
    translationControlsVisible = false;
    recognitionStats = null;
    if (unsubscribeMode) unsubscribeMode();
    unsubscribeMode = null;
    if (unsubscribeNarration) unsubscribeNarration();
    unsubscribeNarration = null;
    clearDownloadProgress();
    if (barElement?.isConnected) barElement.remove();
    resetBarReferences();
  }

  if (typeof articleNarrator?.onStateChange === "function") {
    unsubscribeNarration = articleNarrator.onStateChange(
      onNarrationStateChange,
    );
  }

  return {
    show,
    hide,
    setRecognitionStats,
    setDownloadProgress,
    clearDownloadProgress,
    destroy,
  };
}
