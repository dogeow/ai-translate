import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderConfigFields } from "./ProviderConfigFields.jsx";
import { InfoTip, FieldLabel } from "../common/InfoTip.jsx";
import { isChromeAiProvider } from "../../../shared/settings.js";
import {
  buildProviderDraft,
  getProviderLabel,
} from "./providerUi.js";

export function ProviderModal({
  state,
  settings,
  providerOptions,
  onClose,
  onSubmit,
  testConnectionResult,
  updateConnectionStatus,
  models,
  setOriginsModalOpen,
  onAvailabilityInvalidated,
}) {
  const [draft, setDraft] = useState(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [hasTestedConnection, setHasTestedConnection] = useState(false);
  const [chromeAiAutoReady, setChromeAiAutoReady] = useState(false);
  const [checkingChromeAi, setCheckingChromeAi] = useState(false);
  const draftRef = useRef(null);
  const modelDropdownRef = useRef(null);

  useEffect(() => {
    if (!state) return;
    const nextDraft = buildProviderDraft(settings, state.provider);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setModelDropdownOpen(false);
    setHasTestedConnection(false);
    setChromeAiAutoReady(false);
    setCheckingChromeAi(false);
  }, [state?.mode, state?.provider]);

  useEffect(() => {
    if (!state) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state, onClose]);

  const handleChromeAiAvailabilityChange = useCallback(({ ready }) => {
    setChromeAiAutoReady(!!ready);
  }, []);

  if (!state || !draft) return null;

  const updateDraft = (partial) => {
    setHasTestedConnection(false);
    setDraft((previous) => {
      const next =
        typeof partial === "function"
          ? partial(previous)
          : { ...previous, ...partial };
      draftRef.current = next;
      return next;
    });
  };
  const persistDraft = async () => draftRef.current;
  const changeProvider = (provider) => {
    const nextDraft = buildProviderDraft(settings, provider);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setModelDropdownOpen(false);
    setHasTestedConnection(false);
    setChromeAiAutoReady(false);
    setCheckingChromeAi(false);
  };
  const updateModalConnectionStatus = async (
    nextSettings,
    options = {},
  ) => {
    setHasTestedConnection(true);
    return updateConnectionStatus(nextSettings, {
      ...options,
      updateBannerStatus: state.mode === "add",
    });
  };
  const connectionVerified =
    chromeAiAutoReady ||
    (hasTestedConnection && testConnectionResult.tone === "ok");
  const isChromeAi = isChromeAiProvider(draft.provider);
  const checkChromeAiFromFooter = async () => {
    if (checkingChromeAi) return;
    setCheckingChromeAi(true);
    try {
      await updateModalConnectionStatus(draftRef.current, {
        preserveTestMessage: false,
        updateBannerStatus: false,
        showTestPending: true,
      });
    } finally {
      setCheckingChromeAi(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-modal-title"
    >
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content provider-modal">
        <div className="modal-header">
          <div className="provider-modal__title">
            <h2 id="provider-modal-title">
              {state.mode === "add"
                ? "新增翻译引擎"
                : `设置 ${getProviderLabel(state.provider)}`}
            </h2>
            <InfoTip
              text={
                state.mode === "add"
                  ? "选择引擎并完成可用性测试，添加后可通过卡片或扩展弹窗切换。"
                  : "在这里修改当前引擎的连接、登录和模型配置。"
              }
            />
          </div>
          <button
            type="button"
            className="modal-close provider-modal__close"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="provider-modal__body">
          {state.mode === "add" ? (
            <div className="field provider-modal__provider-select">
              <FieldLabel
                htmlFor="provider-modal-select"
                tip="这里只显示尚未添加的引擎。"
              >
                引擎
              </FieldLabel>
              <select
                id="provider-modal-select"
                className="select"
                value={draft.provider}
                onChange={(event) => changeProvider(event.target.value)}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <ProviderConfigFields
            provider={draft.provider}
            settings={draft}
            updateSettings={updateDraft}
            persistSettings={persistDraft}
            settingsRef={draftRef}
            showAutoSaveStatus={() => {}}
            testConnectionResult={
              hasTestedConnection
                ? testConnectionResult
                : { text: "", tone: "", showAction: false }
            }
            updateConnectionStatus={updateModalConnectionStatus}
            models={models}
            modelDropdownOpen={modelDropdownOpen}
            setModelDropdownOpen={setModelDropdownOpen}
            modelDropdownRef={modelDropdownRef}
            setOriginsModalOpen={setOriginsModalOpen}
            onAvailabilityInvalidated={onAvailabilityInvalidated}
            onChromeAiAvailabilityChange={
              handleChromeAiAvailabilityChange
            }
            showConnectionTest={!isChromeAi}
          />
        </div>

        <div className="provider-modal__footer">
          {state.mode === "add" && !connectionVerified ? (
            <span className="provider-modal__verification-hint">
              待测试
            </span>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          {isChromeAi ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={checkingChromeAi}
              onClick={checkChromeAiFromFooter}
            >
              {checkingChromeAi ? "检测中…" : "检查可用性"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={state.mode === "add" && !connectionVerified}
            onClick={() =>
              onSubmit(draftRef.current, {
                connectionTested: hasTestedConnection,
                connectionVerified,
              })
            }
          >
            {state.mode === "add" ? "添加并使用" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
