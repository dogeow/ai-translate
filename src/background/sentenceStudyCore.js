import {
  SENTENCE_STUDY_MAX_TEXT_LENGTH,
  attachSentenceStudyThinking,
} from "./sentenceStudyStreaming.js";
import {
  buildHeuristicSentenceStudy,
  getFirstSentence,
  shouldUseHeuristicFallback,
} from "./sentenceStudyStructure.js";
import {
  hydrateSentenceStudyTranslations,
  requestSentenceStudy,
} from "./sentenceStudyTranslations.js";

export { hydrateSentenceStudyTranslations };

export async function analyzeSentenceStudy(
  base,
  model,
  original,
  translation,
  runtime = {},
) {
  const trace = {
    thinkingSegments: [],
  };
  const text = String(original || "").trim();
  if (!text || text.length > SENTENCE_STUDY_MAX_TEXT_LENGTH) return null;
  if (!/\s/.test(text)) return null;
  if (!getFirstSentence(text)) return null;

  const prompt = `请做英文句型学习分析，只输出一个 JSON 对象（不要 markdown，不要解释，不要额外文本）。

如果你是推理模型，请不要输出 <think> 内容，直接给 JSON。

格式：
{
  "pattern": "简短中文句型名",
  "parts": [
    {
      "text": "原文连续片段",
      "translation": "中文短语",
      "label": "主语/系动词/谓语/宾语/表语/状语/从句/定语/补足成分",
      "note": "可为空"
    }
  ]
}

约束：
1. 只分析第一句完整英文句子。
2. parts.text 必须逐字符来自原文，顺序一致，不重叠。
3. 所有 parts.text 拼接后必须完整覆盖目标句，不遗漏单词和标点。
4. 主语不要包含系动词或谓语动词。
5. parts.translation 与 note 用简体中文，尽量短。
6. 每个 parts.translation 必须非空；可保留专有名词英文（如 Next.js、React）。
7. 建议切成 3-8 段。

原文：
${text}

译文：
${translation || ""}`;

  try {
    const sentenceStudy = await requestSentenceStudy(
      base,
      model,
      text,
      prompt,
      runtime,
      trace,
    );
    const fallback = shouldUseHeuristicFallback(sentenceStudy, text)
      ? buildHeuristicSentenceStudy(text)
      : sentenceStudy;
    if (!fallback) return null;
    const finalized = await hydrateSentenceStudyTranslations(
      fallback,
      translation,
    );
    return attachSentenceStudyThinking(finalized, trace);
  } catch (_) {
    const fallback = buildHeuristicSentenceStudy(text);
    if (!fallback) return null;
    const finalized = await hydrateSentenceStudyTranslations(
      fallback,
      translation,
    );
    return attachSentenceStudyThinking(finalized, trace);
  }
}
