export const PAGE_TRANSLATE_DISPLAY_MODE_OPTIONS = [
  { value: "original", label: "原文" },
  { value: "translation", label: "译文" },
  { value: "bilingual", label: "双语" },
];

const PAGE_TRANSLATE_DISPLAY_MODES = new Set(
  PAGE_TRANSLATE_DISPLAY_MODE_OPTIONS.map((option) => option.value),
);

export function resolvePageTranslateState(response, fallback = {}) {
  const fallbackMode = PAGE_TRANSLATE_DISPLAY_MODES.has(fallback.mode)
    ? fallback.mode
    : "translation";

  return {
    active:
      typeof response?.active === "boolean"
        ? response.active
        : Boolean(fallback.active),
    mode: PAGE_TRANSLATE_DISPLAY_MODES.has(response?.mode)
      ? response.mode
      : fallbackMode,
  };
}
