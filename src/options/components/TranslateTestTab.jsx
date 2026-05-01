import { useEffect } from "react";
import { LANG_OPTIONS } from "../../shared/constants.js";
import { isChromeAiProvider } from "../../shared/settings.js";

const TRANSLATE_RESULT_CLASSES = {
  error: "test-result-block error",
  empty: "test-result-block empty",
  normal: "test-result-block",
};

function getTranslateResultClass(tone) {
  return TRANSLATE_RESULT_CLASSES[tone] || TRANSLATE_RESULT_CLASSES.normal;
}

export function TranslateTestTab({
  testInput,
  setTestInput,
  testSourceLang,
  setTestSourceLang,
  testTargetLang,
  setTestTargetLang,
  testModelOverride,
  setTestModelOverride,
  models,
  defaultModel,
  detectLangResult,
  testTranslateHint,
  testTranslateResult,
  runDetectLanguage,
  runTranslateTest,
  provider,
}) {
  const isChromeAi = isChromeAiProvider(provider);

  // Chrome 内置 AI 不支持自动识别源语言；如果当前选了 auto，自动改成 English
  useEffect(() => {
    if (isChromeAi && testSourceLang === "auto") {
      setTestSourceLang("English");
    }
  }, [isChromeAi, testSourceLang, setTestSourceLang]);

  const testTranslateClassName = getTranslateResultClass(
    testTranslateResult.tone,
  );
  const modelOptions = Array.isArray(models) ? models : [];
  const hasModelOptions = modelOptions.length > 0;
  const selectedModel = String(testModelOverride || defaultModel || "");

  return (
    <div className="card card-translate-test">
      <h2>翻译测试</h2>
      {hasModelOptions ? (
        <div className="field translate-test-actions">
          <label
            htmlFor="ollamaTestModel"
            className="translate-test-actions__label"
          >
            模型
          </label>
          <div className="translate-test-actions__row">
            <select
              id="ollamaTestModel"
              className="select translate-test-actions__select"
              value={selectedModel}
              onChange={(event) => setTestModelOverride(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="ollamaTestInput">要翻译的文本</label>
        <textarea
          id="ollamaTestInput"
          className="textarea"
          rows="3"
          placeholder="输入要翻译的文本，点击下方按钮测试"
          value={testInput}
          onChange={(event) => setTestInput(event.target.value)}
        ></textarea>
      </div>
      <div className="field translate-test-actions-wrap">
        <div className="field translate-test-actions">
          <label
            htmlFor="ollamaTestSourceLang"
            className="translate-test-actions__label"
          >
            输入语言
          </label>
          <div className="translate-test-actions__row">
            <select
              id="ollamaTestSourceLang"
              className="select translate-test-actions__select"
              value={testSourceLang}
              onChange={(event) => setTestSourceLang(event.target.value)}
            >
              {!isChromeAi ? (
                <option value="auto">自动识别</option>
              ) : null}
              {LANG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!isChromeAi ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={runDetectLanguage}
                >
                  识别语言
                </button>
                <span
                  className={`detect-lang-result ${detectLangResult.isError ? "error" : ""}`.trim()}
                  aria-live="polite"
                >
                  {detectLangResult.text}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="field translate-test-actions">
          <label
            htmlFor="ollamaTestLang"
            className="translate-test-actions__label"
          >
            翻译为
          </label>
          <div className="translate-test-actions__row">
            <select
              id="ollamaTestLang"
              className="select translate-test-actions__select"
              value={testTargetLang}
              onChange={(event) => setTestTargetLang(event.target.value)}
            >
              {LANG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={runTranslateTest}
            >
              测试翻译
            </button>
            <span
              className={`detect-lang-result ${testTranslateHint.isError ? "error" : ""}`.trim()}
              aria-live="polite"
            >
              {testTranslateHint.text}
            </span>
          </div>
        </div>

        <div className="field translate-test-actions translate-test-result-row">
          <label className="translate-test-actions__label">翻译</label>
          <div className={testTranslateClassName} aria-live="polite">
            {testTranslateResult.text}
          </div>
        </div>
      </div>
    </div>
  );
}
