import { useEffect, useState } from "react";
import { PROVIDER_CHATGPT } from "../../../shared/constants.js";
import { getChatGptAuthSummary } from "../../../shared/chatgpt-auth.js";
import {
  getAddedProviders,
  getProviderCardMeta,
  getProviderIconLabel,
  getProviderLabel,
} from "./providerUi.js";

export function ProviderCards({
  settings,
  refreshKey = 0,
  chromeAiRuntimeState = "unknown",
  onSwitch,
  onConfigure,
  onRemove,
  onAdd,
  canAdd,
}) {
  const [chatGptLoggedIn, setChatGptLoggedIn] = useState(false);
  const addedProviders = getAddedProviders(settings);

  useEffect(() => {
    if (!addedProviders.includes(PROVIDER_CHATGPT)) {
      setChatGptLoggedIn(false);
      return;
    }
    let active = true;
    void getChatGptAuthSummary({ refresh: true }).then((summary) => {
      if (active) setChatGptLoggedIn(!!summary.isLoggedIn);
    });
    return () => {
      active = false;
    };
  }, [refreshKey, addedProviders.join("|")]);

  return (
    <div className="provider-manager">
      <div className="provider-manager__header">
        <div className="provider-manager__intro">
          <h2 className="provider-manager__title">翻译引擎</h2>
          <p className="provider-manager__desc">
            添加并切换翻译所用的 AI 服务，点选卡片即可设为当前引擎。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary provider-manager__add"
          disabled={!canAdd}
          onClick={onAdd}
        >
          {canAdd ? "新增引擎" : "已全部添加"}
        </button>
      </div>

      {addedProviders.length === 0 ? (
        <div className="provider-manager__empty">
          <p className="provider-manager__empty-title">还没有翻译引擎</p>
          <p className="provider-manager__empty-desc">
            点击右上角「新增引擎」添加 Ollama、ChatGPT 等服务。
          </p>
          {canAdd ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onAdd}
            >
              新增引擎
            </button>
          ) : null}
        </div>
      ) : (
        <div className="provider-list" role="list">
          {addedProviders.map((provider) => {
            const isActive = settings.provider === provider;
            const meta = getProviderCardMeta(
              provider,
              settings,
              chatGptLoggedIn,
              chromeAiRuntimeState,
            );
            const label = getProviderLabel(provider);
            return (
              <div
                key={provider}
                role="listitem"
                className={`provider-row ${isActive ? "provider-row--active" : ""}`.trim()}
              >
                <button
                  type="button"
                  className="provider-row__main"
                  aria-pressed={isActive}
                  onClick={() => onSwitch(provider)}
                >
                  <span
                    className={`provider-row__radio ${isActive ? "provider-row__radio--on" : ""}`.trim()}
                    aria-hidden="true"
                  />
                  <span className="provider-row__icon">
                    {getProviderIconLabel(provider)}
                  </span>
                  <span className="provider-row__body">
                    <span className="provider-row__top">
                      <span className="provider-row__title">{label}</span>
                      {isActive ? (
                        <span className="provider-row__badge">使用中</span>
                      ) : null}
                    </span>
                    <span className="provider-row__meta">
                      <span className="provider-row__detail">
                        {meta.detail || "默认模型"}
                      </span>
                      <span className="provider-row__dot" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={`provider-row__status ${meta.ready ? "provider-row__status--ready" : "provider-row__status--warn"}`.trim()}
                      >
                        <span
                          className="provider-row__status-dot"
                          aria-hidden="true"
                        />
                        {meta.status}
                      </span>
                    </span>
                  </span>
                </button>
                <span className="provider-row__actions">
                  <button
                    type="button"
                    className="provider-row__btn"
                    aria-label={`设置 ${label}`}
                    title="设置"
                    onClick={() => onConfigure(provider)}
                  >
                    设置
                  </button>
                  <button
                    type="button"
                    className="provider-row__btn provider-row__btn--danger"
                    aria-label={`删除 ${label}`}
                    title="删除"
                    onClick={() => onRemove(provider)}
                  >
                    删除
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
