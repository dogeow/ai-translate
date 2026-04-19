import { useRef, useState } from "react";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  PROVIDER_OLLAMA,
} from "../../shared/constants.js";
import {
  isMiniMaxProvider,
  isGitHubModelsProvider,
} from "../../shared/settings.js";
import { isOllama403Error } from "../../shared/ollama-errors.js";
import { getConfig, runGenerateRequest } from "../lib/utils.js";

const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;
const THINK_TAG_RE = /<\/?think\b[^>]*>/gi;

function stripThinkingText(text) {
  const raw = String(text || "");
  if (!raw) return "";

  let stripped = raw.replace(THINK_BLOCK_RE, "\n");
  const danglingMatch = THINK_OPEN_TAG_RE.exec(stripped);
  if (danglingMatch) {
    stripped = stripped.slice(0, danglingMatch.index);
  }

  return stripped
    .replace(THINK_TAG_RE, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDetectedLanguage(text) {
  const cleaned = stripThinkingText(text);
  if (!cleaned) return "";

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.length > 0 ? lines[lines.length - 1] : cleaned;

  return candidate
    .replace(/^(language|detected language|识别为|语言)\s*[:：]\s*/i, "")
    .replace(/[.。]+$/g, "")
    .trim();
}

function normalizeTranslationText(text) {
  const cleaned = stripThinkingText(text);
  if (cleaned) return cleaned;
  return String(text || "").trim();
}

/**
 * 管理翻译测试面板状态的 hook
 */
export function useTranslateTest({ settingsRef, setConnectionStatus }) {
  const detectRequestIdRef = useRef(0);
  const translateRequestIdRef = useRef(0);
  const [testInput, setTestInput] = useState("");
  const [testSourceLang, setTestSourceLang] = useState("auto");
  const [testTargetLang, setTestTargetLang] = useState(
    DEFAULT_TRANSLATE_TARGET_LANG,
  );
  // 翻译测试面板里允许临时切换模型，不写回设置
  const [testModelOverride, setTestModelOverride] = useState("");
  const [detectLangResult, setDetectLangResult] = useState({
    text: "",
    isError: false,
  });
  const [testTranslateHint, setTestTranslateHint] = useState({
    text: "",
    isError: false,
  });
  const [testTranslateResult, setTestTranslateResult] = useState({
    text: "",
    tone: "empty",
  });

  function show403() {
    setConnectionStatus({
      kind: "403",
      text: "Ollama 已运行，但拒绝扩展请求（403）",
      showAction: true,
    });
  }

  function buildTestConfig() {
    const config = getConfig(settingsRef.current);
    const override = String(testModelOverride || "").trim();
    if (override) {
      return { ...config, model: override };
    }
    return config;
  }

  function formatErrorMessage(error, provider) {
    return (error.message || String(error)) === "Failed to fetch"
      ? provider === PROVIDER_OLLAMA
        ? "Ollama 连接失败"
        : isMiniMaxProvider(provider)
          ? "MiniMax 连接失败"
          : "GitHub Models 连接失败"
      : error.message || String(error);
  }

  function getConfigValidationError(config) {
    if (!config.model) {
      return isMiniMaxProvider(config.provider)
        ? "请先填写 MiniMax 模型"
        : "请先选择模型";
    }
    if (isMiniMaxProvider(config.provider) && !config.apiKey) {
      return `请先填写${config.apiKeyLabel || "MiniMax API Key"}`;
    }
    if (isGitHubModelsProvider(config.provider) && !config.apiKey) {
      return `请先填写${config.apiKeyLabel || "GitHub 访问令牌"}`;
    }
    return "";
  }

  function handleProviderError(config, error) {
    // 仅 Ollama 时才弹 403 横幅，其他厂家的 403 应直接展示原始错误
    if (config.provider === PROVIDER_OLLAMA && isOllama403Error(error)) {
      show403();
      return true;
    }
    return false;
  }

  async function runDetectLanguage() {
    const requestId = ++detectRequestIdRef.current;
    const text = testInput.trim();
    if (!text) {
      setDetectLangResult({ text: "请先输入要识别的文本", isError: true });
      return;
    }

    const config = buildTestConfig();
    const validationError = getConfigValidationError(config);
    if (validationError) {
      setDetectLangResult({ text: validationError, isError: true });
      return;
    }

    setDetectLangResult({ text: "识别中…", isError: false });

    try {
      const prompt =
        "Identify the language of the following text. Reply with only one word: the language name in English (e.g. Chinese, English, Japanese, French, German, Spanish, Korean). No other text.\n\n" +
        text;
      const language = normalizeDetectedLanguage(
        await runGenerateRequest(config, prompt),
      );
      if (requestId !== detectRequestIdRef.current) return;
      setDetectLangResult({
        text: language ? `识别为：${language}` : "未能识别",
        isError: false,
      });
    } catch (error) {
      if (requestId !== detectRequestIdRef.current) return;
      if (handleProviderError(config, error)) {
        setDetectLangResult({ text: "", isError: false });
        return;
      }
      setDetectLangResult({
        text: formatErrorMessage(error, config.provider),
        isError: true,
      });
    }
  }

  async function runTranslateTest() {
    const requestId = ++translateRequestIdRef.current;
    const text = testInput.trim();
    if (!text) {
      setTestTranslateHint({ text: "请先输入要翻译的文本", isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    const config = buildTestConfig();
    const validationError = getConfigValidationError(config);
    if (validationError) {
      setTestTranslateHint({ text: validationError, isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    setTestTranslateHint({ text: "", isError: false });
    setTestTranslateResult({ text: "翻译中…", tone: "normal" });

    try {
      const prompt =
        testSourceLang === "auto"
          ? `Translate the following text to ${testTargetLang}. Detect the source language automatically. Only output the translation, no explanation or extra text.\n\n${text}`
          : `Translate the following text from ${testSourceLang} to ${testTargetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;
      const translation = normalizeTranslationText(
        await runGenerateRequest(config, prompt),
      );
      if (requestId !== translateRequestIdRef.current) return;
      setTestTranslateResult({
        text: translation || "（模型未返回内容）",
        tone: "normal",
      });
    } catch (error) {
      if (requestId !== translateRequestIdRef.current) return;
      if (handleProviderError(config, error)) {
        setTestTranslateResult({ text: "", tone: "empty" });
        return;
      }
      setTestTranslateResult({
        text: formatErrorMessage(error, config.provider),
        tone: "error",
      });
    }
  }

  return {
    testInput,
    setTestInput,
    testSourceLang,
    setTestSourceLang,
    testTargetLang,
    setTestTargetLang,
    testModelOverride,
    setTestModelOverride,
    detectLangResult,
    testTranslateHint,
    testTranslateResult,
    runDetectLanguage,
    runTranslateTest,
  };
}
