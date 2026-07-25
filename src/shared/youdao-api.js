/**
 * 有道词典查询（非官方）
 * 网页版接口 https://dict.youdao.com/jsonapi_s
 *
 * 注意：该接口为有道网页版内部使用，可能随时变动；仅做最佳努力解析。
 */

const YOUDAO_LOOKUP_URL = "https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4";

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

/**
 * 查询单词，返回 { word, ukphone, usphone, phone, translations[], raw }
 */
export async function lookupYoudao(word, { signal } = {}) {
  const trimmed = String(word || "").trim();
  if (!trimmed) {
    throw new Error("empty_word");
  }
  const body = new URLSearchParams({
    q: trimmed,
    le: "en",
    t: String(Date.now()),
    keyfrom: "webdict",
  });
  const response = await fetch(YOUDAO_LOOKUP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
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
    return { word, ukphone: "", usphone: "", phone: "", translations: [], raw: data };
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
    ukphone: ukphone || simpleWord.ukphone || "",
    usphone: usphone || simpleWord.usphone || "",
    phone: phone || simpleWord.phone || "",
    translations,
    raw: data,
  };
}
