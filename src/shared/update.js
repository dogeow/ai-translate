export const UPDATE_MANIFEST_URL =
  "https://raw.githubusercontent.com/dogeow/ai-translate/main/latest.json";
export const UPDATE_RELEASES_PAGE_URL =
  "https://github.com/dogeow/ai-translate/releases";
export const UPDATE_STATE_KEY = "extensionUpdateState";
export const UPDATE_CHECK_ALARM_NAME = "extensionUpdateCheck";
export const UPDATE_CHECK_PERIOD_MINUTES = 720;

export function normalizeUpdateManifestUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeComparableVersion(version) {
  const value = String(version || "").trim();
  const parts = value.split(".");

  if (!value || parts.length < 1 || parts.length > 4) {
    throw new Error(`版本号格式无效：${value || "(empty)"}`);
  }

  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,4})$/.test(part)) {
      throw new Error(`版本号格式无效：${value}`);
    }
    if (Number(part) > 65535) {
      throw new Error(`版本号超出浏览器扩展限制：${value}`);
    }
  }

  return value;
}

export function compareExtensionVersions(left, right) {
  const leftParts = normalizeComparableVersion(left).split(".").map(Number);
  const rightParts = normalizeComparableVersion(right).split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export function readUpdateFeed(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("版本清单必须是 JSON 对象");
  }

  const version = normalizeComparableVersion(payload.version);
  const updateUrl = normalizeUpdateManifestUrl(
    payload.pageUrl ||
      payload.downloadUrl ||
      payload.url ||
      payload.releaseUrl ||
      UPDATE_RELEASES_PAGE_URL,
  );
  const notes =
    typeof payload.notes === "string"
      ? payload.notes.trim()
      : typeof payload.description === "string"
        ? payload.description.trim()
        : "";

  return {
    version,
    updateUrl,
    notes,
  };
}

export function createDefaultUpdateState(currentVersion) {
  return {
    status: "idle",
    currentVersion,
    latestVersion: "",
    manifestUrl: UPDATE_MANIFEST_URL,
    updateUrl: "",
    notes: "",
    checkedAt: 0,
    error: "",
  };
}
