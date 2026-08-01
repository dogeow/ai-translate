import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { calculateRecognitionStats } from "./wordMarker.js";

test("认词率按页面英文单词出现次数计算", () => {
  const dom = new JSDOM(`
    <main>
      <p>Known known learning A I x</p>
      <code>known skipped</code>
      <span class="ai-tr-word" data-word="learning">learning</span>
      <div id="ollama-pt-bar">known skipped</div>
    </main>
  `);

  assert.deepEqual(
    calculateRecognitionStats(dom.window.document.body, {
      known: { addedAt: 1 },
      a: { addedAt: 2 },
    }),
    {
      knownCount: 3,
      totalCount: 6,
      percentage: 50,
    },
  );
  dom.window.close();
});

test("没有英文单词时认词率为零", () => {
  const dom = new JSDOM("<main>只有中文内容</main>");
  assert.deepEqual(calculateRecognitionStats(dom.window.document.body, {}), {
    knownCount: 0,
    totalCount: 0,
    percentage: 0,
  });
  dom.window.close();
});
