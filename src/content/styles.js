/** 注入滑词翻译用到的全局样式 */
import {
  BUTTON_ID,
  HOVER_TARGET_INDICATOR_ID,
  TIP_ID,
  STYLE_ID,
  SHORTCUT_HINT_ID,
} from "./constants.js";

export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* ===== Theme tokens ===== */
:root {
    --ollama-button-text: #ffffff;
    --ollama-button-gradient: linear-gradient(135deg, #6366f1, #7c3aed);
    --ollama-button-gradient-hover: linear-gradient(135deg, #4f46e5, #6d28d9);
    --ollama-button-shadow: 0 2px 12px rgba(99, 102, 241, 0.35), 0 1px 3px rgba(0,0,0,0.2);
    --ollama-button-shadow-hover: 0 4px 16px rgba(99, 102, 241, 0.45), 0 1px 3px rgba(0,0,0,0.2);

    --ollama-surface: #131316;
    --ollama-surface-alt: #18181b;
    --ollama-panel: #0f0f12;
    --ollama-border: #27272a;
    --ollama-border-soft: #2a2a4a;
    --ollama-border-soft-hover: #3a3a5c;
    --ollama-text: #e4e4e7;
    --ollama-text-strong: #f4f4f5;
    --ollama-text-secondary: #a1a1aa;
    --ollama-text-muted: #71717a;
    --ollama-text-disabled: #52525b;
    --ollama-focus: #6366f1;
    --ollama-focus-ring: rgba(30, 30, 58, 0.9);
    --ollama-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
    --ollama-shortcut-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    --ollama-placeholder: linear-gradient(90deg, #27272a, #3f3f46, #27272a);
    --ollama-scrollbar: #27272a;

    --ollama-error-text: #fca5a5;
    --ollama-error-bg: #1c1517;
    --ollama-error-border: rgba(239, 68, 68, 0.4);
    --ollama-error-border-strong: #ef4444;

    --ollama-copy-bg: #818cf8;
    --ollama-copy-bg-hover: #7c7ff0;
    --ollama-copy-border: #6366f1;
    --ollama-copy-text: #ffffff;

    --ollama-grammar-bg: #1a1a2e;
    --ollama-grammar-line: linear-gradient(90deg, #6366f1, #2a2a4a);
    --ollama-grammar-role-bg: #1e1e3a;
    --ollama-grammar-role-text: #a5b4fc;
}

@media (prefers-color-scheme: light) {
    :root {
        --ollama-button-shadow: 0 8px 20px rgba(79, 70, 229, 0.16), 0 2px 6px rgba(15, 23, 42, 0.08);
        --ollama-button-shadow-hover: 0 10px 24px rgba(79, 70, 229, 0.2), 0 3px 8px rgba(15, 23, 42, 0.1);

        --ollama-surface: #ffffff;
        --ollama-surface-alt: #f8fafc;
        --ollama-panel: #f3f4f6;
        --ollama-border: #d7deea;
        --ollama-border-soft: #cfd7e6;
        --ollama-border-soft-hover: #bcc7da;
        --ollama-text: #1f2937;
        --ollama-text-strong: #111827;
        --ollama-text-secondary: #4b5563;
        --ollama-text-muted: #6b7280;
        --ollama-text-disabled: #94a3b8;
        --ollama-focus: #4f46e5;
        --ollama-focus-ring: rgba(79, 70, 229, 0.18);
        --ollama-shadow: 0 18px 38px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.08);
        --ollama-shortcut-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
        --ollama-placeholder: linear-gradient(90deg, #e5e7eb, #cbd5e1, #e5e7eb);
        --ollama-scrollbar: #cbd5e1;

        --ollama-error-text: #b91c1c;
        --ollama-error-bg: #fff1f2;
        --ollama-error-border: rgba(220, 38, 38, 0.2);
        --ollama-error-border-strong: #dc2626;

        --ollama-copy-bg: #eef2ff;
        --ollama-copy-bg-hover: #e0e7ff;
        --ollama-copy-border: #c7d2fe;
        --ollama-copy-text: #4338ca;

        --ollama-grammar-bg: #eef2ff;
        --ollama-grammar-line: linear-gradient(90deg, #6366f1, #c7d2fe);
        --ollama-grammar-role-bg: #e0e7ff;
        --ollama-grammar-role-text: #4338ca;
    }
}

#${TIP_ID},
#${SHORTCUT_HINT_ID} {
    color-scheme: dark;
}

@media (prefers-color-scheme: light) {
    #${TIP_ID},
    #${SHORTCUT_HINT_ID} {
        color-scheme: light;
    }
}

/* ===== Hover translate button ===== */
#${BUTTON_ID} {
    position: absolute;
    z-index: 2147483646;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ollama-button-text);
    background: var(--ollama-button-gradient);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: var(--ollama-button-shadow);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    letter-spacing: 0.01em;
}
#${BUTTON_ID}:hover {
    background: var(--ollama-button-gradient-hover);
    transform: scale(1.03);
    box-shadow: var(--ollama-button-shadow-hover);
}

/* ===== Hover translation target ===== */
#${HOVER_TARGET_INDICATOR_ID} {
    position: fixed;
    z-index: 2147483645;
    box-sizing: border-box;
    pointer-events: none;
    border: 1px solid rgba(99, 102, 241, 0.72);
    border-radius: 5px;
    background: rgba(99, 102, 241, 0.09);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.08);
    transition:
        left 0.08s ease,
        top 0.08s ease,
        width 0.08s ease,
        height 0.08s ease,
        background 0.08s ease;
}

#${HOVER_TARGET_INDICATOR_ID}[data-scope="paragraph"] {
    border-color: rgba(99, 102, 241, 0.58);
    border-radius: 8px;
    background: rgba(99, 102, 241, 0.055);
}

/* ===== Tip container ===== */
#${TIP_ID} {
    --ollama-tip-max-height: min(80vh, 820px);
    position: fixed;
    z-index: 2147483647;
    max-width: min(420px, calc(100vw - 16px));
    min-width: 260px;
    max-height: var(--ollama-tip-max-height);
    padding: 0;
    font-size: 13px;
    color: var(--ollama-text);
    background: var(--ollama-surface);
    border: 1px solid var(--ollama-border);
    border-radius: 14px;
    box-shadow:
        var(--ollama-shadow);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
    animation: ollama-tip-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
}

#${TIP_ID}[data-width-mode="medium"] {
    max-width: min(560px, calc(100vw - 16px));
    min-width: 300px;
}

#${TIP_ID}[data-width-mode="wide"] {
    max-width: min(720px, calc(100vw - 16px));
    min-width: 340px;
}

#${TIP_ID} .ollama-tip-content {
    flex: 1 1 auto;
    min-height: 0;
    max-height: calc(var(--ollama-tip-max-height) - 49px);
    overflow-y: scroll;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--ollama-scrollbar) transparent;
    -webkit-overflow-scrolling: touch;
}

#${TIP_ID} .ollama-tip-content::-webkit-scrollbar {
    width: 8px;
}
#${TIP_ID} .ollama-tip-content::-webkit-scrollbar-track {
    background: transparent;
}
#${TIP_ID} .ollama-tip-content::-webkit-scrollbar-thumb {
    background: var(--ollama-scrollbar);
    border-radius: 999px;
}

@keyframes ollama-tip-enter {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ===== Tip inner wrapper ===== */
#${TIP_ID} .ollama-tip-body {
    padding: 14px 16px;
}

/* ===== Header ===== */
#${TIP_ID} .ollama-tip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 11px 12px 11px 16px;
    background: var(--ollama-surface-alt);
    border-bottom: 1px solid var(--ollama-border);
    margin: 0;
}

#${TIP_ID} .ollama-tip-title {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--ollama-text-secondary);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
}

#${TIP_ID} .ollama-tip-header-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

#${TIP_ID} .ollama-tip-header-model {
    color: var(--ollama-text-disabled);
    font-size: 11px;
    letter-spacing: 0.02em;
    max-width: min(42vw, 280px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#${TIP_ID} .ollama-tip-close {
    background: none;
    border: none;
    color: var(--ollama-text-disabled);
    cursor: pointer;
    padding: 0;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
}
#${TIP_ID} .ollama-tip-close:hover {
    background: var(--ollama-border);
    color: var(--ollama-text);
}

/* ===== Model select (need-model state) ===== */
#${TIP_ID} .ollama-tip-model-select {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    background: var(--ollama-panel);
    color: var(--ollama-text);
    border: 1px solid var(--ollama-border);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s ease;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px;
}
#${TIP_ID} .ollama-tip-model-select:focus {
    border-color: var(--ollama-focus);
    box-shadow: 0 0 0 3px var(--ollama-focus-ring);
}
#${TIP_ID} .ollama-tip-model-select option {
    direction: rtl;
    text-align: left;
    padding-right: 10px;
}

/* ===== Translate button (need-model state) ===== */
#${TIP_ID} .ollama-tip-translate-btn {
    width: 100%;
    padding: 9px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ollama-button-text);
    background: var(--ollama-button-gradient);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 10px;
    transition: opacity 0.15s ease, transform 0.1s ease;
    letter-spacing: 0.01em;
}
#${TIP_ID} .ollama-tip-translate-btn:hover {
    opacity: 0.9;
}
#${TIP_ID} .ollama-tip-translate-btn:active {
    transform: scale(0.98);
}
#${TIP_ID} .ollama-tip-translate-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

/* ===== Sections ===== */
#${TIP_ID} .ollama-tip-section {
    margin-top: 12px;
    padding: 0;
}
#${TIP_ID} .ollama-tip-section:first-child {
    margin-top: 0;
}
#${TIP_ID} .ollama-tip-section:last-child {
    padding-bottom: 2px;
}

/* ===== Labels ===== */
#${TIP_ID} .ollama-tip-label {
    color: var(--ollama-text-muted);
    font-size: 11px;
    font-weight: 500;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* ===== Text content ===== */
#${TIP_ID} .ollama-tip-text {
    word-break: break-word;
    white-space: pre-wrap;
    color: var(--ollama-text-strong);
    font-size: 13px;
    line-height: 1.6;
}

#${TIP_ID} .ollama-tip-original-inline {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
}

#${TIP_ID} .ollama-tip-original-inline .ollama-tip-text {
    min-width: 0;
}

#${TIP_ID} .ollama-tip-pronounce {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 25px;
    height: 25px;
    padding: 0;
    color: var(--ollama-text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    transition:
        color 0.15s ease,
        background 0.15s ease,
        border-color 0.15s ease;
}

#${TIP_ID} .ollama-tip-pronounce:hover,
#${TIP_ID} .ollama-tip-pronounce.is-playing {
    color: var(--ollama-focus);
    background: var(--ollama-focus-ring);
    border-color: var(--ollama-border-soft);
}

#${TIP_ID} .ollama-tip-pronounce:focus-visible {
    outline: none;
    color: var(--ollama-focus);
    box-shadow: 0 0 0 3px var(--ollama-focus-ring);
}

#${TIP_ID} .ollama-tip-pronounce-icon {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
}

#${TIP_ID} .ollama-tip-translation-inline {
    color: var(--ollama-text-strong);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}

#${TIP_ID} .ollama-tip-translation-content {
    white-space: inherit;
}

/* ===== Loading state ===== */
#${TIP_ID} .ollama-tip-loading {
    color: var(--ollama-text-muted);
    font-size: 12px;
    margin-top: 2px;
}

#${TIP_ID} .ollama-tip-text--streaming {
    position: relative;
    margin-top: 8px;
}

#${TIP_ID} .ollama-tip-streaming-cursor {
    display: inline-block;
    width: 7px;
    height: 1.1em;
    margin-left: 2px;
    border-radius: 999px;
    background: var(--ollama-accent);
    vertical-align: text-bottom;
    animation: ollama-tip-caret-blink 1s ease-in-out infinite;
}

#${TIP_ID} .ollama-tip-thinking {
    margin-top: 8px;
    padding: 10px 12px;
    border: 1px solid var(--ollama-border-soft);
    border-radius: 10px;
    background: var(--ollama-panel);
}

#${TIP_ID} .ollama-tip-download {
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid var(--ollama-border-soft);
    border-radius: 10px;
    background: var(--ollama-panel);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#${TIP_ID} .ollama-tip-download-label {
    color: var(--ollama-text-secondary);
    font-size: 12px;
    font-weight: 600;
}

#${TIP_ID} .ollama-tip-download-track {
    height: 6px;
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.18);
    overflow: hidden;
}

#${TIP_ID} .ollama-tip-download-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: inherit;
    transition: width 120ms ease-out;
}

#${TIP_ID} .ollama-tip-download-hint {
    color: var(--ollama-text-muted);
    font-size: 11px;
    line-height: 1.5;
}

#${TIP_ID} .ollama-tip-thinking-label {
    color: var(--ollama-text-muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

#${TIP_ID} .ollama-tip-thinking-content {
    margin-top: 6px;
    color: var(--ollama-text-secondary);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 160px;
    overflow: auto;
    scrollbar-width: thin;
}

#${TIP_ID} .ollama-tip-thinking-content--preview {
    max-height: none;
    overflow: hidden;
}

#${TIP_ID} .ollama-tip-thinking-details {
    margin-top: 8px;
    border: 1px solid var(--ollama-border-soft);
    border-radius: 10px;
    background: var(--ollama-panel);
    overflow: hidden;
}

#${TIP_ID} .ollama-tip-thinking-summary {
    position: relative;
    list-style: none;
    cursor: pointer;
    padding: 10px 30px 10px 12px;
}

#${TIP_ID} .ollama-tip-thinking-summary::-webkit-details-marker {
    display: none;
}

#${TIP_ID} .ollama-tip-thinking-summary::after {
    content: "▾";
    position: absolute;
    right: 10px;
    top: 10px;
    color: var(--ollama-text-muted);
    font-size: 11px;
    line-height: 1;
    transition: transform 0.15s ease;
}

#${TIP_ID} .ollama-tip-thinking-details[open] .ollama-tip-thinking-summary::after {
    transform: rotate(180deg);
}

#${TIP_ID} .ollama-tip-thinking-summary-title {
    display: block;
    color: var(--ollama-text-muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

#${TIP_ID} .ollama-tip-thinking-details .ollama-tip-thinking-content {
    margin-top: 0;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--ollama-border-soft);
}

#${TIP_ID} .ollama-tip-placeholder {
    height: 10px;
    margin-top: 8px;
    border-radius: 999px;
    background: var(--ollama-placeholder);
    background-size: 200% 100%;
    animation: ollama-tip-loading 1.5s ease-in-out infinite;
}
#${TIP_ID} .ollama-tip-placeholder--short { width: 62%; }
#${TIP_ID} .ollama-tip-placeholder--title { width: 48%; }

/* ===== Error ===== */
#${TIP_ID} .ollama-tip-error {
    color: var(--ollama-error-text);
    font-size: 12px;
    line-height: 1.5;
    padding: 8px 10px;
    background: var(--ollama-error-bg);
    border: 1px solid var(--ollama-error-border);
    border-radius: 8px;
    border-left: 3px solid var(--ollama-error-border-strong);
}

/* ===== Copy button ===== */
#${TIP_ID} .ollama-tip-copy {
    font-weight: 900;
    color: var(--ollama-text-muted);
    background: transparent;
    border: none;
}

/* ===== Word learning actions ===== */
#${TIP_ID} .ollama-tip-word-learning {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--ollama-border);
}

#${TIP_ID} .ollama-tip-word-status {
    flex: 1 1 0;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    color: var(--ollama-text-secondary);
    background: var(--ollama-panel);
    border: 1px solid var(--ollama-border);
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition:
        color 0.15s ease,
        background 0.15s ease,
        border-color 0.15s ease;
}

#${TIP_ID} .ollama-tip-word-status:hover:not(:disabled) {
    color: var(--ollama-text-strong);
    border-color: var(--ollama-border-soft-hover);
}

#${TIP_ID} .ollama-tip-word-status:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--ollama-focus-ring);
}

#${TIP_ID} .ollama-tip-word-status:disabled {
    cursor: default;
}

#${TIP_ID} .ollama-tip-word-status--studying.is-active {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.38);
}

#${TIP_ID} .ollama-tip-word-status--known.is-active {
    color: #4ade80;
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.38);
}

#${TIP_ID} .ollama-tip-word-status kbd {
    flex: 0 0 auto;
    color: var(--ollama-text-disabled);
    background: transparent;
    border: 0;
    font: inherit;
    font-size: 10px;
}

#${TIP_ID} .ollama-tip-word-learning-error {
    flex: 0 0 100%;
    color: var(--ollama-error-text);
    font-size: 11px;
}

#${TIP_ID} .ollama-tip-word-learning.has-error {
    flex-wrap: wrap;
}

/* ===== Grammar / Sentence Study Section ===== */
#${TIP_ID} .ollama-tip-grammar-section {
    margin-top: 14px;
    padding: 14px 16px 14px;
    border-top: 1px solid var(--ollama-border);
    background: var(--ollama-panel);
}

#${TIP_ID} .ollama-tip-grammar-pattern {
    color: var(--ollama-text-strong);
    font-size: 13px;
    font-weight: 600;
    margin-top: 6px;
    line-height: 1.5;
}

#${TIP_ID} .ollama-tip-grammar-parts {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--ollama-scrollbar) transparent;
}
#${TIP_ID} .ollama-tip-grammar-parts::-webkit-scrollbar {
    height: 4px;
}
#${TIP_ID} .ollama-tip-grammar-parts::-webkit-scrollbar-track {
    background: transparent;
}
#${TIP_ID} .ollama-tip-grammar-parts::-webkit-scrollbar-thumb {
    background: var(--ollama-scrollbar);
    border-radius: 2px;
}

#${TIP_ID} .ollama-tip-grammar-thinking {
    margin-top: 12px;
}

#${TIP_ID} .ollama-tip-grammar-thinking .ollama-tip-thinking-details {
    margin-top: 0;
}

#${TIP_ID} .ollama-tip-grammar-part {
    flex: 0 0 auto;
    width: fit-content;
    max-width: min(230px, calc(100vw - 96px));
    padding: 10px 12px;
    background: var(--ollama-grammar-bg);
    border: 1px solid var(--ollama-border-soft);
    border-radius: 10px;
    transition: border-color 0.15s ease;
}
#${TIP_ID} .ollama-tip-grammar-part:hover {
    border-color: var(--ollama-border-soft-hover);
}

#${TIP_ID} .ollama-tip-grammar-text {
    color: var(--ollama-text-strong);
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    font-weight: 500;
}

#${TIP_ID} .ollama-tip-grammar-translation {
    color: var(--ollama-text-secondary);
    font-size: 12px;
    line-height: 1.45;
    margin-top: 5px;
    word-break: break-word;
}

#${TIP_ID} .ollama-tip-grammar-line {
    width: 100%;
    height: 1px;
    margin: 8px 0;
    background: var(--ollama-grammar-line);
}

#${TIP_ID} .ollama-tip-grammar-role {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--ollama-grammar-role-bg);
    color: var(--ollama-grammar-role-text);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

#${TIP_ID} .ollama-tip-grammar-note {
    color: var(--ollama-text-muted);
    font-size: 11px;
    line-height: 1.45;
    margin-top: 6px;
}

#${TIP_ID} .ollama-tip-grammar-empty {
    color: var(--ollama-text-muted);
    font-size: 12px;
    line-height: 1.5;
    margin-top: 6px;
    font-style: italic;
}

/* ===== Shortcut hint toast ===== */
#${SHORTCUT_HINT_ID} {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ollama-text);
    background: var(--ollama-surface);
    border: 1px solid var(--ollama-border);
    border-radius: 10px;
    box-shadow:
        var(--ollama-shortcut-shadow);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    pointer-events: none;
    animation: ollama-tip-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    letter-spacing: 0.01em;
}

/* ===== Visual page translate pending mark ===== */
.ollama-page-translate-pending {
    text-decoration-line: underline !important;
    text-decoration-style: wavy !important;
    text-decoration-color: rgba(245, 158, 11, 0.92) !important;
    text-decoration-thickness: 1.5px !important;
    text-underline-offset: 2px !important;
}

@media (prefers-color-scheme: light) {
    .ollama-page-translate-pending {
        text-decoration-color: rgba(217, 119, 6, 0.9);
    }
}

/* ===== Page translate display modes ===== */
.ollama-pt-wrap {
    display: inline;
}
.ollama-pt-orig,
.ollama-pt-trans {
    display: inline;
}
/* Default fallback (in case no mode class is set): show translation only */
.ollama-pt-orig { display: none; }

html.ollama-pt-mode-translation .ollama-pt-orig { display: none; }
html.ollama-pt-mode-translation .ollama-pt-trans { display: inline; }

html.ollama-pt-mode-original .ollama-pt-orig { display: inline; }
html.ollama-pt-mode-original .ollama-pt-trans { display: none; }

html.ollama-pt-mode-bilingual .ollama-pt-orig {
    display: inline;
    opacity: 0.62;
}
html.ollama-pt-mode-bilingual .ollama-pt-trans {
    display: inline;
}
html.ollama-pt-mode-bilingual .ollama-pt-trans::before {
    content: " · ";
    opacity: 0.5;
    margin: 0 2px;
}

.ollama-article-narration-current {
    position: relative !important;
    border-radius: 6px !important;
    background: rgba(99, 102, 241, 0.14) !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.46) !important;
    transition: background 160ms ease, box-shadow 160ms ease !important;
}

.ollama-article-narration-start-flash {
    animation: ollama-article-narration-start-flash 0.7s ease !important;
}
@keyframes ollama-article-narration-start-flash {
    0% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0); background: rgba(250, 204, 21, 0.0); }
    30% { box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.85); background: rgba(250, 204, 21, 0.28); }
    100% { box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.46); background: rgba(99, 102, 241, 0.14); }
}

/* Current spoken word — CSS Custom Highlight API (no DOM rewrite) */
::highlight(ollama-article-narration-word) {
    background-color: #facc15;
    color: #111827;
    text-shadow: none;
}

/* Primary word mark: fixed overlay (works with recognition spans / transformed body) */
#ollama-article-narration-word-overlay {
    all: initial;
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    width: 0 !important;
    height: 0 !important;
    overflow: visible !important;
    pointer-events: none !important;
    z-index: 2147483645 !important;
}
#ollama-article-narration-word-overlay .ollama-article-narration-word-mark {
    position: fixed !important;
    box-sizing: border-box !important;
    border-radius: 4px !important;
    background: rgba(253, 224, 71, 0.55) !important;
    border: 2px solid #b45309 !important;
    box-shadow:
      0 0 0 1px #fbbf24,
      0 1px 3px rgba(0, 0, 0, 0.2) !important;
    pointer-events: none !important;
}
.ollama-article-narration-word-active {
    background: #fde047 !important;
    background-color: #fde047 !important;
    color: #111827 !important;
    border: 2px solid #b45309 !important;
    border-radius: 4px !important;
    box-shadow: 0 0 0 1px #fbbf24, 0 1px 3px rgba(0, 0, 0, 0.18) !important;
}

/* ===== Page translate control bar ===== */
#ollama-pt-bar {
    all: initial;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    min-width: 220px;
    background: rgba(20, 20, 24, 0.92);
    color: #fafafa;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    user-select: none;
}

#ollama-pt-bar.ollama-pt-bar--recognition-only {
    gap: 0;
    min-width: 0;
    padding: 4px;
    border-radius: 999px;
}

#ollama-pt-bar .ollama-pt-bar-row {
    display: flex;
    align-items: center;
    gap: 4px;
}

#ollama-pt-bar .ollama-pt-bar-row[hidden] {
    display: none;
}

#ollama-pt-bar .ollama-pt-bar-recognition-row {
    justify-content: center;
    padding: 2px;
}

#ollama-pt-bar .ollama-pt-bar-narration-row {
    min-width: 280px;
    padding: 1px 2px 0 8px;
}

#ollama-pt-bar .ollama-pt-bar-narration-label {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: rgba(250, 250, 250, 0.9);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#ollama-pt-bar .ollama-pt-bar-narration-options {
    padding: 0 4px 3px;
}

#ollama-pt-bar .ollama-pt-bar-select {
    appearance: none;
    flex: 1 1 0;
    min-width: 0;
    height: 27px;
    padding: 0 20px 0 8px;
    color: rgba(250, 250, 250, 0.84);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    outline: none;
    background-color: rgba(255, 255, 255, 0.06);
    background-image:
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      calc(100% - 10px) 11px,
      calc(100% - 7px) 11px;
    background-repeat: no-repeat;
    background-size: 3px 3px, 3px 3px;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
}

#ollama-pt-bar .ollama-pt-bar-select:hover,
#ollama-pt-bar .ollama-pt-bar-select:focus {
    color: #fff;
    border-color: rgba(129, 140, 248, 0.6);
}

#ollama-pt-bar .ollama-pt-bar-recognition-label {
    width: auto;
    padding: 5px 10px;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
}

#ollama-pt-bar .ollama-pt-bar-progress-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 10px 6px;
}

#ollama-pt-bar .ollama-pt-bar-progress-row[hidden] {
    display: none;
}

#ollama-pt-bar .ollama-pt-bar-progress-label {
    font-size: 11px;
    color: rgba(250, 250, 250, 0.78);
}

#ollama-pt-bar .ollama-pt-bar-progress-track {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
}

#ollama-pt-bar .ollama-pt-bar-progress-bar {
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: inherit;
    transition: width 120ms ease-out;
}

#ollama-pt-bar * { box-sizing: border-box; }

#ollama-pt-bar .ollama-pt-bar-btn {
    appearance: none;
    background: transparent;
    color: rgba(250, 250, 250, 0.7);
    border: none;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms, color 120ms;
}

#ollama-pt-bar .ollama-pt-bar-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

#ollama-pt-bar .ollama-pt-bar-btn--active {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
}

#ollama-pt-bar .ollama-pt-bar-divider {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.12);
    margin: 0 2px;
}

#ollama-pt-bar .ollama-pt-bar-stop {
    color: rgba(252, 165, 165, 0.85);
}

#ollama-pt-bar .ollama-pt-bar-stop:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
}

@media (prefers-color-scheme: light) {
    #ollama-pt-bar {
        background: rgba(255, 255, 255, 0.96);
        color: #18181b;
        border-color: rgba(0, 0, 0, 0.08);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
    #ollama-pt-bar .ollama-pt-bar-btn {
        color: rgba(24, 24, 27, 0.7);
    }
    #ollama-pt-bar .ollama-pt-bar-btn:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #18181b;
    }
    #ollama-pt-bar .ollama-pt-bar-divider {
        background: rgba(0, 0, 0, 0.1);
    }
    #ollama-pt-bar .ollama-pt-bar-narration-label {
        color: rgba(24, 24, 27, 0.9);
    }
    #ollama-pt-bar .ollama-pt-bar-select {
        color: rgba(24, 24, 27, 0.78);
        border-color: rgba(0, 0, 0, 0.12);
        background-color: rgba(0, 0, 0, 0.04);
    }
    #ollama-pt-bar .ollama-pt-bar-select:hover,
    #ollama-pt-bar .ollama-pt-bar-select:focus {
        color: #18181b;
        border-color: rgba(79, 70, 229, 0.5);
    }
}

/* ===== Skeleton loading animation ===== */
@keyframes ollama-tip-loading {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

@keyframes ollama-tip-caret-blink {
    0%, 45% { opacity: 1; }
    55%, 100% { opacity: 0.18; }
}
`;
  (document.head || document.documentElement).appendChild(style);
}
