import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHeuristicSentenceStudy,
  normalizeInlineWhitespace,
  shouldUseHeuristicFallback,
} from "./sentenceStudyStructure.js";
import { hydrateSentenceStudyTranslations } from "./sentenceStudyTranslations.js";

const PUT_FORWARD_SENTENCE =
  "They put forward opinions and suggestions on issues including fostering and strengthening new growth drivers and promoting the integrated development of innovation and industrial chains.";

test("句型兜底会拆解 put forward，而不是把整句标成主句", () => {
  const result = buildHeuristicSentenceStudy(PUT_FORWARD_SENTENCE);

  assert.ok(result);
  assert.deepEqual(
    result.parts.map((part) => part.label),
    ["主语", "谓语", "宾语", "定语", "定语"],
  );
  assert.deepEqual(
    result.parts.map((part) => part.text),
    [
      "They",
      "put forward",
      "opinions and suggestions",
      "on issues",
      "including fostering and strengthening new growth drivers and promoting the integrated development of innovation and industrial chains.",
    ],
  );
  assert.equal(
    normalizeInlineWhitespace(result.parts.map((part) => part.text).join(" ")),
    normalizeInlineWhitespace(PUT_FORWARD_SENTENCE),
  );
  assert.equal(result.parts.some((part) => part.label === "主句"), false);
  assert.equal(result.pattern, "主谓宾+定语");
});

test("退化结果重建后每个结构片段都有中文释义", async () => {
  const structured = buildHeuristicSentenceStudy(PUT_FORWARD_SENTENCE);
  const result = await hydrateSentenceStudyTranslations(
    structured,
    "他们对培育和加强新的增长动力，促进创新和产业链的综合发展提出了意见和建议。",
  );

  assert.deepEqual(
    result.parts.map((part) => part.translation),
    [
      "他们",
      "提出",
      "意见和建议",
      "关于相关问题",
      "包括培育和壮大新的增长动力，并促进创新和产业链融合发展",
    ],
  );
});

test("模型返回完整单块或主句标签时必须进入结构化兜底", () => {
  assert.equal(
    shouldUseHeuristicFallback(
      {
        pattern: "主句",
        parts: [
          {
            text: PUT_FORWARD_SENTENCE,
            translation: "他们提出了意见和建议。",
            label: "主句",
            note: "",
          },
        ],
      },
      PUT_FORWARD_SENTENCE,
    ),
    true,
  );

  assert.equal(
    shouldUseHeuristicFallback(
      {
        pattern: "主句+成分",
        parts: [
          { text: "They", label: "主句" },
          {
            text: PUT_FORWARD_SENTENCE.slice("They ".length),
            label: "成分",
          },
        ],
      },
      PUT_FORWARD_SENTENCE,
    ),
    true,
  );
});

test("助动词与主要动词组成谓语短语", () => {
  const result = buildHeuristicSentenceStudy(
    "They will promote the integrated development of industrial chains.",
  );

  assert.ok(result);
  assert.deepEqual(
    result.parts.slice(0, 3).map((part) => [part.text, part.label]),
    [
      ["They", "主语"],
      ["will promote", "谓语"],
      ["the integrated development of industrial chains.", "宾语"],
    ],
  );
});
