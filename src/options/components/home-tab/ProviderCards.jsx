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
          暂无已添加引擎，请点击“新增引擎”。
        </div>
      ) : (
        <div className="provider-grid">
          {addedProviders.map((provider) => {
            const isActive = settings.provider === provider;
            const meta = getProviderCardMeta(
              provider,
              settings,
              chatGptLoggedIn,
              chromeAiRuntimeState,
            );
            return (
              <div
                key={provider}
                className={`provider-card ${isActive ? "provider-card--active" : ""}`.trim()}
              >
                <button
                  type="button"
                  className="provider-card__switch"
                  aria-pressed={isActive}
                  onClick={() => onSwitch(provider)}
                >
                  <span className="provider-card__icon">
                    {getProviderIconLabel(provider)}
                  </span>
                  <span className="provider-card__content">
                    <span className="provider-card__title">
                      {getProviderLabel(provider)}
                    </span>
                    <span className="provider-card__detail">
                      {meta.detail || "默认模型"}
                    </span>
                    <span
                      className={`provider-card__status ${meta.ready ? "provider-card__status--ready" : ""}`.trim()}
                    >
                      <span aria-hidden="true"></span>
                      {meta.status}
                    </span>
                  </span>
                </button>
                <span className="provider-card__actions">
                  {isActive ? (
                    <span className="provider-card__active-badge">
                      使用中
                    </span>
                  ) : null}
                  <span className="provider-card__action-buttons">
                    <button
                      type="button"
                      className="provider-card__settings"
                      aria-label={`设置 ${getProviderLabel(provider)}`}
                      title="设置"
                      onClick={() => onConfigure(provider)}
                    >
                      设置
                    </button>
                    <button
                      type="button"
                      className="provider-card__delete"
                      aria-label={`删除 ${getProviderLabel(provider)}`}
                      title="删除"
                      onClick={() => onRemove(provider)}
                    >
                      删除
                    </button>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
