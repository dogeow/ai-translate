const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "LINK",
  "META",
  "HEAD",
  "BR",
]);

function isElementVisible(element, view) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = view?.innerHeight || 800;
  const viewportWidth = view?.innerWidth || 1200;
  if (rect.width < 8 || rect.height < 8) return false;
  if (
    rect.bottom < 0 ||
    rect.top > viewportHeight ||
    rect.right < 0 ||
    rect.left > viewportWidth
  ) {
    return false;
  }
  const style = view?.getComputedStyle?.(element);
  if (!style) return true;
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number.parseFloat(style.opacity || "1") > 0
  );
}

function escapeIdent(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/[^\w-]/g, "\\$&");
}

function describeElement(element) {
  const id = element.id ? `#${escapeIdent(element.id)}` : "";
  const classNames = [...element.classList]
    .slice(0, 3)
    .map((name) => `.${escapeIdent(name)}`)
    .join("");
  const extra = [];
  if (element.tagName === "IMG") {
    const alt = (element.getAttribute("alt") || "").trim().slice(0, 40);
    if (alt) extra.push(`alt="${alt}"`);
    extra.push("has-image");
  }
  const text = [...element.childNodes]
    .filter((node) => node.nodeType === 3)
    .map((node) => String(node.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 40);
  if (text) extra.push(`"${text}"`);
  return `${element.tagName.toLowerCase()}${id}${classNames}${
    extra.length ? ` ${extra.join(" ")}` : ""
  }`;
}

export function collectUiRewriteSnapshot(doc = document, options = {}) {
  const maxChars = options.maxChars || 7000;
  const maxLines = options.maxLines || 90;
  const skipIds = new Set(options.skipIds || []);
  const view = doc.defaultView;
  const root = doc.body;
  if (!root) return "";

  const preferred = root.querySelectorAll(
    "h1,h2,h3,h4,button,a,input,textarea,select,img,svg,picture,video,canvas,label,[role='button'],p,li,nav,main,header,footer",
  );
  const fallback = root.querySelectorAll("div,span,section,article");
  const seen = new Set();
  const lines = [];

  function add(element) {
    if (!element || seen.has(element) || SKIP_TAGS.has(element.tagName)) return;
    if (skipIds.has(element.id)) return;
    if (element.closest && [...skipIds].some((id) => element.closest(`#${id}`))) {
      return;
    }
    if (!isElementVisible(element, view)) return;
    seen.add(element);
    lines.push(describeElement(element));
  }

  preferred.forEach((element) => add(element));
  if (lines.length < 40) {
    fallback.forEach((element) => add(element));
  }

  let output = "";
  for (const line of lines.slice(0, maxLines)) {
    const next = output ? `${output}\n${line}` : line;
    if (next.length > maxChars) break;
    output = next;
  }
  return output;
}
