import {
  isEditableShortcutTarget,
  resolveWordLearningShortcut,
} from "./tip/wordLearningActions.js";

export function resolveWordMarkerCardShortcut(event, activeWord) {
  const word = String(activeWord || "").trim();
  if (!word || isEditableShortcutTarget(event?.target)) return null;
  const status = resolveWordLearningShortcut(event);
  return status ? { word, status } : null;
}
