export function getSidePanelSupport(
  chromeApi = globalThis.chrome,
  browserApi = globalThis.browser,
) {
  return {
    chrome: typeof chromeApi?.sidePanel?.open === "function",
    firefox:
      typeof (browserApi?.sidebarAction || chromeApi?.sidebarAction)?.open ===
      "function",
  };
}

export function openSidePanel({
  windowId,
  chromeApi = globalThis.chrome,
  browserApi = globalThis.browser,
} = {}) {
  if (typeof chromeApi?.sidePanel?.open === "function") {
    if (!Number.isInteger(windowId)) {
      return Promise.reject(new Error("Missing current window id"));
    }
    return chromeApi.sidePanel.open({ windowId });
  }

  const sidebarAction = browserApi?.sidebarAction || chromeApi?.sidebarAction;
  if (typeof sidebarAction?.open === "function") {
    return Promise.resolve(sidebarAction.open());
  }

  return Promise.reject(new Error("Side panel is not supported"));
}
