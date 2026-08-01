const MODIFIER_EVENT_KEYS = Object.freeze({
  alt: "Alt",
  shift: "Shift",
  control: "Control",
  meta: "Meta",
});

export function isHoverModifierActive(event, modifierKey) {
  if (!event || modifierKey === "none") return false;
  if (modifierKey === "shift") return !!event.shiftKey;
  if (modifierKey === "control") return !!event.ctrlKey;
  if (modifierKey === "meta") return !!event.metaKey;
  return !!event.altKey;
}

export function isHoverModifierKeyEvent(event, modifierKey) {
  const eventKey = MODIFIER_EVENT_KEYS[modifierKey];
  return !!eventKey && event?.key === eventKey;
}

export function resolveHoverModifierActiveForTarget({
  modifierActive = false,
  modifierKey = "alt",
  recognitionModeWord = false,
} = {}) {
  if (
    modifierActive &&
    modifierKey === "alt" &&
    recognitionModeWord
  ) {
    return false;
  }
  return !!modifierActive;
}
