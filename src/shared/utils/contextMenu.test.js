import test from "node:test";
import assert from "node:assert/strict";
import {
  buildContextMenuItems,
  MENU_AUTO_MODE_HOVER,
  MENU_AUTO_MODE_SELECTION,
  MENU_ENABLE_APP,
  MENU_HOVER_SCOPE_PARENT,
  MENU_HOVER_SCOPE_WORD,
  MENU_LEARNING_MODE,
  MENU_OPEN_OPTIONS,
  MENU_REWRITE_PAGE,
  MENU_WORD_MARKING,
  RADIO_MENU_SETTINGS,
} from "./contextMenu.js";

const ACTION_TOP_LEVEL_LIMIT = 6;

function byId(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

test("应用关闭时只保留启用与设置入口", () => {
  const items = buildContextMenuItems({ appEnabled: false });
  assert.deepEqual(
    items.map((item) => item.id),
    [MENU_ENABLE_APP, MENU_OPEN_OPTIONS],
  );
});

test("菜单 ID 唯一，扩展图标顶层项不超过浏览器上限", () => {
  const items = buildContextMenuItems({ autoTranslateMode: "hover" });
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);

  const actionTopLevel = items.filter(
    (item) => !item.parentId && item.contexts.includes("action"),
  );
  assert.ok(actionTopLevel.length <= ACTION_TOP_LEVEL_LIMIT);
  assert.ok(actionTopLevel.some((item) => item.id === MENU_REWRITE_PAGE));
});

test("单选与复选状态反映当前设置", () => {
  const items = byId(
    buildContextMenuItems({
      autoTranslateMode: "selection",
      hoverTranslateScope: "word",
      learningModeEnabled: true,
      wordMarkingEnabled: false,
    }),
  );
  assert.equal(items[MENU_AUTO_MODE_SELECTION].checked, true);
  assert.equal(items[MENU_AUTO_MODE_HOVER].checked, false);
  assert.equal(items[MENU_HOVER_SCOPE_WORD].checked, true);
  assert.equal(items[MENU_LEARNING_MODE].checked, true);
  assert.equal(items[MENU_WORD_MARKING].checked, false);
});

test("悬停范围仅在悬停模式下可用", () => {
  const hover = byId(buildContextMenuItems({ autoTranslateMode: "hover" }));
  const hotkey = byId(buildContextMenuItems({ autoTranslateMode: "hotkey" }));
  assert.equal(hover[MENU_HOVER_SCOPE_PARENT].enabled, true);
  assert.equal(hotkey[MENU_HOVER_SCOPE_PARENT].enabled, false);
});

test("单选菜单映射到对应设置键", () => {
  assert.deepEqual(RADIO_MENU_SETTINGS[MENU_AUTO_MODE_HOVER], {
    key: "autoTranslateMode",
    value: "hover",
  });
  assert.deepEqual(RADIO_MENU_SETTINGS[MENU_HOVER_SCOPE_WORD], {
    key: "hoverTranslateScope",
    value: "word",
  });
});
