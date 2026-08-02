/**
 * 有道词典查询（非官方）
 * 网页版接口 https://dict.youdao.com/jsonapi_s
 *
 * 注意：该接口为有道网页版内部使用，可能随时变动；仅做最佳努力解析。
 */

export const YOUDAO_LOOKUP_BASE = "https://dict.youdao.com/jsonapi_s";

export const YOUDAO_AUDIO_BASE = "https://dict.youdao.com/dictvoice";

export function buildYoudaoAudioUrl(word, type = 2) {
  const safeWord = encodeURIComponent(String(word || "").trim());
  const safeType = type === 1 ? 1 : 2; // 1=英音 2=美音
  return `${YOUDAO_AUDIO_BASE}?audio=${safeWord}&type=${safeType}`;
}

export function isPronounceableEnglishWord(word) {
  const normalizedWord = String(word || "").trim();
  return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(normalizedWord);
}

export function buildYoudaoLookupUrl(word) {
  const params = new URLSearchParams({
    q: String(word || "").trim(),
    le: "en",
    client: "mobile",
  });
  return `${YOUDAO_LOOKUP_BASE}?${params.toString()}`;
}

function readYoudaoPhrase(value) {
  if (typeof value === "string") return value.trim();
  const nested = value?.l?.i;
  if (typeof nested === "string") return nested.trim();
  if (Array.isArray(nested)) return String(nested[0] || "").trim();
  return "";
}

export function getYoudaoResponseWord(data) {
  const ecWord = Array.isArray(data?.ec?.word)
    ? data.ec.word[0]
    : data?.ec?.word;
  const simpleWord = Array.isArray(data?.simple?.word)
    ? data.simple.word[0]
    : data?.simple?.word;
  const candidates = [
    data?.input,
    data?.simple?.query,
    readYoudaoPhrase(ecWord?.["return-phrase"]),
    readYoudaoPhrase(simpleWord?.["return-phrase"]),
  ];
  return String(
    candidates.find((value) => String(value || "").trim()) || "",
  ).trim();
}

/**
 * 查询单词，返回 { word, ukphone, usphone, phone, translations[], raw }
 */
export async function lookupYoudao(word, { signal } = {}) {
  const trimmed = String(word || "").trim();
  if (!trimmed) {
    throw new Error("empty_word");
  }
  const response = await fetch(buildYoudaoLookupUrl(trimmed), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`youdao_http_${response.status}`);
  }
  const data = await response.json().catch(() => null);
  return parseYoudaoResponse(trimmed, data);
}

function parseYoudaoResponse(word, data) {
  if (!data || typeof data !== "object") {
    return {
      word,
      responseWord: "",
      ukphone: "",
      usphone: "",
      phone: "",
      translations: [],
      raw: data,
    };
  }
  const ec = data.ec || data.simple || {};
  const wordEntry = (ec.word && (Array.isArray(ec.word) ? ec.word[0] : ec.word)) || null;
  const ukphone = wordEntry?.ukphone || wordEntry?.ukspeech || "";
  const usphone = wordEntry?.usphone || wordEntry?.usspeech || "";
  const phone = wordEntry?.phone || "";

  const translations = [];
  const trsList = wordEntry?.trs;
  if (Array.isArray(trsList)) {
    for (const tr of trsList) {
      // 新格式：{ pos: 'n.', tran: '名词解释' }
      if (tr?.pos || tr?.tran) {
        const pos = (tr.pos || "").trim();
        const tran = (tr.tran || "").trim();
        if (tran) {
          translations.push(pos ? `${pos} ${tran}` : tran);
        }
        continue;
      }
      // 旧格式：{ tr: [{ l: { i: ['n. ...'] } }] }
      const inner = tr?.tr;
      if (Array.isArray(inner)) {
        for (const innerItem of inner) {
          const lines = innerItem?.l?.i;
          if (Array.isArray(lines)) {
            for (const line of lines) {
              const text =
                typeof line === "string" ? line : line?.["#text"] || "";
              if (text) translations.push(String(text).trim());
            }
          }
        }
      }
    }
  }

  // simple.word[0].phones 中也可能有更详细的音标，保险兜底
  const simpleWord = data.simple?.word?.[0] || {};
  return {
    word,
    responseWord: getYoudaoResponseWord(data),
    ukphone: ukphone || simpleWord.ukphone || "",
    usphone: usphone || simpleWord.usphone || "",
    phone: phone || simpleWord.phone || "",
    translations,
    raw: data,
  };
}
