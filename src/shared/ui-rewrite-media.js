export const MAX_REWRITE_IMAGES = 3;
export const MAX_REWRITE_USER_IMAGES = 2;

export function extractDataUrl(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return String(value.dataUrl || value.url || "").trim();
  }
  return "";
}

export function isImageDataUrl(value) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(extractDataUrl(value));
}

export function stripDataUrlToBase64(value) {
  const dataUrl = extractDataUrl(value);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function normalizeRewriteImages(images, limit = MAX_REWRITE_IMAGES) {
  const source = Array.isArray(images) ? images : [];
  const result = [];
  const seen = new Set();
  for (const item of source) {
    const dataUrl = extractDataUrl(item);
    if (!isImageDataUrl(dataUrl) || seen.has(dataUrl)) continue;
    seen.add(dataUrl);
    result.push({ dataUrl });
    if (result.length >= limit) break;
  }
  return result;
}

export function mergeRewriteImages(screenshotDataUrl, userImages = []) {
  const extras = normalizeRewriteImages(userImages, MAX_REWRITE_USER_IMAGES);
  const images = [];
  if (isImageDataUrl(screenshotDataUrl)) {
    images.push({ dataUrl: extractDataUrl(screenshotDataUrl) });
  }
  images.push(...extras);
  return images.slice(0, MAX_REWRITE_IMAGES);
}

export function buildOpenAiChatUserContent(prompt, images = []) {
  const normalized = normalizeRewriteImages(images);
  if (normalized.length === 0) return String(prompt || "");
  return [
    { type: "text", text: String(prompt || "") },
    ...normalized.map((image) => ({
      type: "image_url",
      image_url: { url: image.dataUrl },
    })),
  ];
}

export function isImageUnsupportedError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return /image|vision|multimodal|does not support|unsupported content|invalid content/.test(
    message,
  );
}
