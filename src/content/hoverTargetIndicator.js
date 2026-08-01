import { HOVER_TARGET_INDICATOR_ID } from "./constants.js";
import { injectStyles } from "./styles.js";

function getIndicatorElement() {
  let indicator = document.getElementById(HOVER_TARGET_INDICATOR_ID);
  if (indicator) return indicator;

  injectStyles();
  indicator = document.createElement("div");
  indicator.id = HOVER_TARGET_INDICATOR_ID;
  indicator.setAttribute("aria-hidden", "true");
  indicator.style.display = "none";
  document.body.appendChild(indicator);
  return indicator;
}

export function showHoverTargetIndicator(rect, scope = "word") {
  if (!rect) return;
  const indicator = getIndicatorElement();
  const padding = scope === "paragraph" ? 4 : 2;
  const left = Math.max(0, Number(rect.left || 0) - padding);
  const top = Math.max(0, Number(rect.top || 0) - padding);
  const width = Math.max(1, Number(rect.width || 0) + padding * 2);
  const height = Math.max(1, Number(rect.height || 0) + padding * 2);

  indicator.dataset.scope = scope === "paragraph" ? "paragraph" : "word";
  indicator.style.left = `${left}px`;
  indicator.style.top = `${top}px`;
  indicator.style.width = `${width}px`;
  indicator.style.height = `${height}px`;
  indicator.style.display = "block";
}

export function hideHoverTargetIndicator() {
  const indicator = document.getElementById(HOVER_TARGET_INDICATOR_ID);
  if (indicator) indicator.style.display = "none";
}

export function removeHoverTargetIndicator() {
  document.getElementById(HOVER_TARGET_INDICATOR_ID)?.remove();
}
