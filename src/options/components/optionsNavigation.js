import {
  IconHome,
  IconCursor,
  IconPage,
  IconTranslate,
  IconKeyboard,
  IconCache,
  IconLogs,
  IconBook,
  IconInfo,
  IconWand,
  IconWords,
} from "./NavIcons.jsx";

export const OPTIONS_NAV_ITEMS = Object.freeze([
  { id: "home", label: "首页", Icon: IconHome },
  { id: "pick-mode", label: "取词方式", Icon: IconCursor },
  { id: "page-translate", label: "页面翻译", Icon: IconPage },
  { id: "translate", label: "翻译测试", Icon: IconTranslate },
  { id: "shortcuts", label: "快捷键", Icon: IconKeyboard },
  { id: "translation-cache", label: "翻译缓存", Icon: IconCache },
  { id: "logs", label: "请求日志", Icon: IconLogs },
  { id: "learning", label: "学习模式", Icon: IconBook },
  { id: "ui-rewrite", label: "AI 页面改造", Icon: IconWand },
  { id: "word-learning", label: "英语学习", Icon: IconWords },
  { id: "about", label: "关于", Icon: IconInfo },
]);

export const OPTIONS_TAB_ORDER = OPTIONS_NAV_ITEMS.map(({ id }) => id);
export const OPTIONS_DEFAULT_TAB = OPTIONS_TAB_ORDER[0];

export function getOptionsTabButtonId(tabId) {
  return `options-tab-${tabId}`;
}

export function getOptionsTabPanelId(tabId) {
  return `options-tabpanel-${tabId}`;
}