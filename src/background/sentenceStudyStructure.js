const AUXILIARY_VERBS = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "can",
  "could",
  "will",
  "would",
  "should",
  "may",
  "might",
  "must",
]);
const PREPOSITIONS = new Set([
  "for",
  "to",
  "without",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "as",
  "if",
  "when",
  "while",
  "because",
  "after",
  "before",
  "during",
  "through",
  "into",
  "about",
  "over",
  "under",
]);
const SENTENCE_PART_LABELS = new Set([
  "主语",
  "系动词",
  "谓语",
  "宾语",
  "表语",
  "状语",
  "从句",
  "定语",
  "主句",
  "补足成分",
  "助动词",
  "动词",
  "成分",
]);

export function normalizeInlineWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizePartTranslation(text) {
  return String(text || "")
    .trim()
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/^(中文|释义|翻译)[:：]\s*/u, "")
    .replace(/^[\-\d.)\s]+/, "")
    .replace(/[。；;]+$/u, "")
    .trim()
    .slice(0, 40);
}

export function hasLatinLetters(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

export function hasCjkChars(text) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(String(text || ""));
}

export function extractLatinTokens(text) {
  return String(text || "").match(/[A-Za-z][A-Za-z0-9.+-]*/g) || [];
}

function hasKana(text) {
  return /[\u3040-\u30ff\u31f0-\u31ff]/.test(String(text || ""));
}

export function getFirstSentence(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : normalized).trim();
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function getLastPart(parts) {
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function joinPartTexts(parts) {
  return parts
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:?!])/g, "$1")
    .trim();
}

function inferSentencePattern(parts) {
  const labels = parts
    .map((part) => String(part.label || "").trim())
    .filter(Boolean);
  return labels.join("+") || "句型分析";
}

function normalizeSentencePattern(pattern, parts) {
  const raw = String(pattern || "").trim();
  if (!raw) return inferSentencePattern(parts);
  if (raw.length > 40) return inferSentencePattern(parts);
  if (/[A-Za-z]{3,}/.test(raw)) return inferSentencePattern(parts);
  if (hasKana(raw)) return inferSentencePattern(parts);
  return raw;
}

function inferPartLabel(text, previousLabel = "") {
  const trimmed = String(text || "").trim();
  const firstWord = trimmed
    .replace(/^[^A-Za-z]+/, "")
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (!trimmed) return "成分";
  if (/^(am|is|are|was|were|be|been|being)$/i.test(trimmed)) return "系动词";
  if (AUXILIARY_VERBS.has(firstWord)) return "助动词";
  if (!previousLabel) return "主语";
  if (previousLabel === "主语") return "谓语";
  if (previousLabel === "系动词") return "表语";
  if (PREPOSITIONS.has(firstWord)) return "状语";
  return "补足成分";
}

function mergeLeadingSubjectPhrase(parts) {
  if (!Array.isArray(parts) || parts.length < 2) return parts || [];
  const verbLabels = new Set(["系动词", "谓语", "助动词", "动词"]);
  const boundaryLabels = new Set(["状语", "从句", "表语", "宾语"]);
  const firstVerbIndex = parts.findIndex((part) =>
    verbLabels.has(String(part.label || "").trim()),
  );
  if (firstVerbIndex <= 0) return parts;

  const leading = parts.slice(0, firstVerbIndex);
  if (
    leading.some((part, index) => {
      const label = String(part.label || "").trim();
      if (index === 0) return false;
      return boundaryLabels.has(label);
    })
  ) {
    return parts;
  }

  return [
    {
      text: joinPartTexts(leading),
      translation: "",
      label: "主语",
      note: "",
    },
    ...parts.slice(firstVerbIndex),
  ];
}

function splitLeakedSubjectVerb(part) {
  if (String(part?.label || "").trim() !== "主语") return [part];
  const match = String(part.text || "").match(
    /^(.*?)(?:\s+)(am|is|are|was|were|be|been|being)$/i,
  );
  if (!match) return [part];
  const subjectText = match[1].trim();
  const verbText = match[2].trim();
  if (!subjectText || !verbText) return [part];
  return [
    {
      ...part,
      text: subjectText,
      translation: "",
      note: part.note || "",
    },
    {
      text: verbText,
      translation: "",
      label: "系动词",
      note: "",
    },
  ];
}

function pushSentencePart(parts, part) {
  const text = String(part?.text || "");
  if (!normalizeInlineWhitespace(text)) return;
  const normalized = {
    text: text.trim(),
    translation: String(part?.translation || "").trim(),
    label: String(part?.label || "").trim() || inferPartLabel(text),
    note: String(part?.note || "").trim(),
  };
  if (/^[.?!,:;]+$/.test(normalized.text) && parts.length > 0) {
    parts[parts.length - 1].text += normalized.text;
    return;
  }
  parts.push(normalized);
}

export function normalizeSentenceStudy(data) {
  if (!data || typeof data !== "object") return null;

  const pattern = String(data.pattern || "")
    .trim()
    .slice(0, 80);
  const parts = [];

  if (Array.isArray(data.parts)) {
    data.parts.slice(0, 6).forEach((part) => {
      const text = String(part?.text || "")
        .trim()
        .slice(0, 120);
      if (!text) return;
      const previousLabel = getLastPart(parts)?.label || "";
      const rawLabel = String(part?.label || "")
        .trim()
        .slice(0, 40);
      const label = SENTENCE_PART_LABELS.has(rawLabel)
        ? rawLabel
        : inferPartLabel(text, previousLabel);
      parts.push({
        text,
        translation: String(part?.translation || "")
          .trim()
          .slice(0, 120),
        label,
        note: String(part?.note || "")
          .trim()
          .slice(0, 80),
      });
    });
  }

  if (!pattern || parts.length === 0) return null;
  return { pattern, parts };
}

export function finalizeSentenceStudy(sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const parts = mergeLeadingSubjectPhrase(sentenceStudy.parts);
  if (parts.length === 0) return null;
  return {
    pattern: normalizeSentencePattern(sentenceStudy.pattern, parts),
    parts,
  };
}

function validateSentenceStudyCoverage(original, sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  let cursor = 0;
  for (const part of sentenceStudy.parts) {
    const index = targetSentence.indexOf(part.text, cursor);
    if (index === -1) return null;
    if (normalizeInlineWhitespace(targetSentence.slice(cursor, index)) !== "") {
      return null;
    }
    const end = index + part.text.length;
    const previousChar = index > 0 ? targetSentence[index - 1] : "";
    const nextChar = end < targetSentence.length ? targetSentence[end] : "";
    const firstChar = part.text[0] || "";
    const lastChar = part.text[part.text.length - 1] || "";
    if (/[A-Za-z]/.test(previousChar) && /[A-Za-z]/.test(firstChar)) return null;
    if (/[A-Za-z]/.test(lastChar) && /[A-Za-z]/.test(nextChar)) return null;
    if (!SENTENCE_PART_LABELS.has(String(part.label || "").trim())) return null;
    cursor = end;
  }

  if (normalizeInlineWhitespace(targetSentence.slice(cursor)) !== "") return null;

  const combined = normalizeInlineWhitespace(
    sentenceStudy.parts.map((part) => part.text).join(" "),
  );
  if (combined !== normalizeInlineWhitespace(targetSentence)) return null;
  return sentenceStudy;
}

export function repairSentenceStudyCoverage(original, sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;
  if (validateSentenceStudyCoverage(original, sentenceStudy)) {
    return sentenceStudy;
  }

  const rawParts = sentenceStudy.parts.flatMap(splitLeakedSubjectVerb);
  const repairedParts = [];
  let cursor = 0;

  for (const rawPart of rawParts) {
    let candidate = String(rawPart.text || "").trim();
    if (!candidate) continue;
    let index = targetSentence.indexOf(candidate, cursor);
    if (index === -1) {
      const withoutTrailingPunctuation = candidate.replace(/[.?!,:;]+$/, "");
      if (withoutTrailingPunctuation && withoutTrailingPunctuation !== candidate) {
        candidate = withoutTrailingPunctuation;
        index = targetSentence.indexOf(candidate, cursor);
      }
    }
    if (index === -1) continue;

    const gap = targetSentence.slice(cursor, index);
    if (normalizeInlineWhitespace(gap)) {
      pushSentencePart(repairedParts, {
        text: gap,
        label: inferPartLabel(gap, getLastPart(repairedParts)?.label),
      });
    }

    pushSentencePart(repairedParts, {
      ...rawPart,
      text: targetSentence.slice(index, index + candidate.length),
    });
    cursor = index + candidate.length;
  }

  const tail = targetSentence.slice(cursor);
  if (normalizeInlineWhitespace(tail)) {
    pushSentencePart(repairedParts, {
      text: tail,
      label: inferPartLabel(tail, getLastPart(repairedParts)?.label),
    });
  }

  if (repairedParts.length === 0) return null;
  return finalizeSentenceStudy({
    pattern: sentenceStudy.pattern || inferSentencePattern(repairedParts),
    parts: repairedParts,
  });
}

export function buildHeuristicSentenceStudy(original) {
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  const parts = [];

  function splitMainClause(mainClauseText) {
    const clauseParts = [];
    const words = String(mainClauseText || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return clauseParts;

    function cleanWord(word) {
      return String(word || "")
        .toLowerCase()
        .replace(/^[^a-z]+|[^a-z]+$/gi, "");
    }

    function isLikelyFiniteVerb(token) {
      if (!token) return false;
      if (AUXILIARY_VERBS.has(token)) return true;
      if (/^(enable|enables|allow|allows|help|helps|make|makes|provide|provides)$/i.test(token)) {
        return true;
      }
      return /^[a-z]{3,}(s|ed)$/i.test(token);
    }

    const verbIndex = words.findIndex((word) => isLikelyFiniteVerb(cleanWord(word)));
    if (verbIndex <= 0) {
      pushSentencePart(clauseParts, { text: mainClauseText, label: "主句" });
      return clauseParts;
    }

    const subject = words.slice(0, verbIndex).join(" ");
    const verb = words[verbIndex];
    const restWords = words.slice(verbIndex + 1);
    pushSentencePart(clauseParts, { text: subject, label: "主语" });
    pushSentencePart(clauseParts, {
      text: verb,
      label: inferPartLabel(verb, "主语"),
    });

    if (restWords.length === 0) return clauseParts;

    const firstRestToken = cleanWord(restWords[0]);
    const objectPronouns = new Set(["me", "you", "him", "her", "it", "us", "them"]);

    let remainingWords = restWords;
    if (objectPronouns.has(firstRestToken)) {
      pushSentencePart(clauseParts, {
        text: restWords[0],
        label: "宾语",
      });
      remainingWords = restWords.slice(1);
    }

    const remaining = remainingWords.join(" ").trim();
    if (!remaining) return clauseParts;

    const restChunks = remaining
      .split(/\s+(?=with|without|in|on|at|by|from|as|if|when|while|because|after|before)\b/i)
      .filter(Boolean);

    restChunks.forEach((chunk, index) => {
      const label =
        index === 0 ? (/^to\b/i.test(chunk) ? "补足成分" : "宾语") : "状语";
      pushSentencePart(clauseParts, { text: chunk, label });
    });

    return clauseParts;
  }

  const commaIndex = targetSentence.indexOf(",");
  if (commaIndex > 0 && commaIndex < targetSentence.length - 1) {
    const lead = targetSentence.slice(0, commaIndex + 1).trim();
    const mainClause = targetSentence.slice(commaIndex + 1).trim();
    if (lead && mainClause) {
      pushSentencePart(parts, { text: lead, label: "状语" });
      splitMainClause(mainClause).forEach((part) => pushSentencePart(parts, part));
    }
  }

  if (parts.length > 1) {
    return finalizeSentenceStudy({
      pattern: inferSentencePattern(parts),
      parts,
    });
  }

  const fallbackParts = [];
  const words = targetSentence.split(/\s+/);
  const verbIndex = words.findIndex((word) =>
    /^(am|is|are|was|were|be|been|being|do|does|did|have|has|had|can|could|will|would|should|may|might|must)$/i.test(
      word.replace(/[.?!,:;]+$/g, ""),
    ),
  );

  if (verbIndex > 0) {
    const subject = words.slice(0, verbIndex).join(" ");
    const verb = words[verbIndex];
    const rest = words.slice(verbIndex + 1).join(" ");
    pushSentencePart(fallbackParts, { text: subject, label: "主语" });
    pushSentencePart(fallbackParts, {
      text: verb,
      label: inferPartLabel(verb, "主语"),
    });
    if (rest) {
      const restChunks = rest
        .split(/\s+(?=without|with|in|on|at|by|from|as|if|when|while|because|after|before)\b/i)
        .filter(Boolean);
      restChunks.forEach((chunk, index) => {
        pushSentencePart(fallbackParts, {
          text: chunk,
          label: index === 0 && /^(for|to)\b/i.test(chunk) ? "表语" : "状语",
        });
      });
    }
  } else {
    pushSentencePart(fallbackParts, { text: targetSentence, label: "主句" });
  }

  return fallbackParts.length > 0
    ? finalizeSentenceStudy({
        pattern: inferSentencePattern(fallbackParts),
        parts: fallbackParts,
      })
    : null;
}

export function shouldUseHeuristicFallback(sentenceStudy, original) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return true;
  const parts = sentenceStudy.parts;
  if (parts.length <= 1) return true;

  const targetSentence = normalizeInlineWhitespace(getFirstSentence(original));
  const combined = normalizeInlineWhitespace(
    parts.map((part) => part.text).join(" "),
  );
  if (targetSentence && combined !== targetSentence) return true;

  const uniqueLabels = new Set(
    parts.map((part) => String(part.label || "").trim()).filter(Boolean),
  );
  if (uniqueLabels.size <= 1 && parts.length <= 2) return true;

  return false;
}
