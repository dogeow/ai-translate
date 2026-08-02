export const ENGLISH_EXAMPLE_PAGE_URL = "https://english.www.gov.cn/news/";

export function openEnglishExamplePage(
  chromeApi = globalThis.chrome,
) {
  if (typeof chromeApi?.tabs?.create !== "function") return false;
  chromeApi.tabs.create({ url: ENGLISH_EXAMPLE_PAGE_URL });
  return true;
}
