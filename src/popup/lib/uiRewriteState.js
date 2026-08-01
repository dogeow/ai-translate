import { UI_REWRITE_ORIGINAL_VERSION } from "../../shared/ui-rewrites.js";

export function resolveUiRewriteViewState(rule) {
  if (!rule || typeof rule !== "object") {
    return {
      hasRule: false,
      isActive: false,
      activeVersionLabel: "",
    };
  }

  const activeVersionId = String(rule.activeVersionId || "");
  const isActive =
    Boolean(activeVersionId) &&
    activeVersionId !== UI_REWRITE_ORIGINAL_VERSION;
  const activeVersion = isActive
    ? (rule.versions || []).find((version) => version?.id === activeVersionId)
    : null;

  return {
    hasRule: true,
    isActive,
    activeVersionLabel: String(activeVersion?.label || ""),
  };
}
