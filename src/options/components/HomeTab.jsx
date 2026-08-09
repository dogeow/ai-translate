import { useCallback, useEffect, useRef, useState } from "react";
import {
  LANG_OPTIONS,
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
} from "../../shared/constants.js";
import { detectChromeAiRuntimeAvailability } from "../../shared/chrome-ai-verification.js";
import { Card } from "./common/Card.jsx";
import { FIELD_IDS } from "./home-tab/constants.js";
import { ProviderCards } from "./home-tab/ProviderCards.jsx";
import { ProviderModal } from "./home-tab/ProviderModal.jsx";
import {
  buildActivatedProviderSettings,
  buildRemovedProviderSettings,
  buildSavedProviderSettings,
  getAvailableProviders,
  getProviderLabel,
} from "./home-tab/providerUi.js";

export function HomeTab({
  settings,
  isSettingsLoaded,
  updateSettings,
  settingsRef,
  setOriginsModalOpen,
  testConnectionResult,
  updateConnectionStatus,
  models,
}) {
  const [providerModalState, setProviderModalState] = useState(null);
  const [providerCardsRefreshKey, setProviderCardsRefreshKey] = useState(0);
  const [chromeAiRuntimeState, setChromeAiRuntimeState] =
    useState("unknown");
  const providerSetupLinkHandledRef = useRef(false);
  const availableProviders = getAvailableProviders(settings);
  const addedProvidersKey = (settings.addedProviders || []).join("|");

  useEffect(() => {
    if (!isSettingsLoaded) return undefined;
    let active = true;
    setChromeAiRuntimeState("checking");
    void detectChromeAiRuntimeAvailability(settings).then((result) => {
      if (!active) return;
      setChromeAiRuntimeState(
        result.checked
          ? result.ready
            ? "ready"
            : "unavailable"
          : "unknown",
      );
    });
    return () => {
      active = false;
    };
  }, [
    addedProvidersKey,
    isSettingsLoaded,
    providerCardsRefreshKey,
    settings.translateTargetLang,
  ]);

  const closeProviderModal = useCallback(() => {
    setProviderModalState(null);
    setProviderCardsRefreshKey((value) => value + 1);
  }, []);

  const switchProvider = (provider) => {
    if (provider === settingsRef.current.provider) return;
    const nextSettings = buildActivatedProviderSettings(
      settingsRef.current,
      provider,
    );
    updateSettings(() => nextSettings, "now");
    void updateConnectionStatus(nextSettings, {
      preserveTestMessage: false,
      updateBannerStatus: true,
      showTestPending: true,
    });
  };

  const openAddProvider = () => {
    const firstAvailable = getAvailableProviders(settingsRef.current)[0];
    if (!firstAvailable) return;
    setProviderModalState({
      mode: "add",
      provider: firstAvailable.value,
    });
  };

  const openProviderSettings = (provider) => {
    setProviderModalState({ mode: "edit", provider });
  };

  const removeProvider = (provider) => {
    const label = getProviderLabel(provider);
    if (
      !window.confirm(
        `删除 ${label}？已填写的配置会保留，之后可以重新添加。`,
      )
    ) {
      return;
    }

    const previousSettings = settingsRef.current;
    const nextSettings = buildRemovedProviderSettings(
      previousSettings,
      provider,
    );
    updateSettings(() => nextSettings, "now");

    if (
      previousSettings.provider === provider ||
      nextSettings.addedProviders.length === 0
    ) {
      void updateConnectionStatus(nextSettings, {
        preserveTestMessage: false,
        updateBannerStatus: true,
        showTestPending: true,
      });
    }
  };

  const invalidateProviderVerification = useCallback(
    (provider) => {
      updateSettings(
        (previous) => ({
          ...previous,
          verifiedProviders: (previous.verifiedProviders || []).filter(
            (item) => item !== provider,
          ),
        }),
        "now",
      );
    },
    [updateSettings],
  );

  useEffect(() => {
    if (!isSettingsLoaded || providerSetupLinkHandledRef.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("add-provider") !== "1") return;

    providerSetupLinkHandledRef.current = true;
    const firstAvailable = getAvailableProviders(settingsRef.current)[0];
    if (firstAvailable) {
      setProviderModalState({
        mode: "add",
        provider: firstAvailable.value,
      });
    }
    url.searchParams.delete("add-provider");
    history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [isSettingsLoaded, settingsRef]);

  const saveProvider = (
    draft,
    {
      connectionTested = false,
      connectionVerified = false,
    } = {},
  ) => {
    const isAdding = providerModalState?.mode === "add";
    const previousProvider = settingsRef.current.provider;
    const nextSettings = buildSavedProviderSettings(
      settingsRef.current,
      draft,
      isAdding,
      connectionVerified,
      connectionTested,
    );

    updateSettings(() => nextSettings, "now");
    closeProviderModal();

    if (!isAdding && draft.provider === previousProvider) {
      void updateConnectionStatus(nextSettings, {
        preserveTestMessage: false,
        updateBannerStatus: true,
        showTestPending: true,
      });
    }
  };

  return (
    <>
      <ProviderModal
        key={
          providerModalState
            ? `${providerModalState.mode}:${providerModalState.provider}`
            : "provider-modal-closed"
        }
        state={providerModalState}
        settings={settings}
        providerOptions={availableProviders}
        onClose={closeProviderModal}
        onSubmit={saveProvider}
        testConnectionResult={testConnectionResult}
        updateConnectionStatus={updateConnectionStatus}
        models={models}
        activeProvider={settings.provider}
        setOriginsModalOpen={(isOpen) => {
          if (isOpen) closeProviderModal();
          setOriginsModalOpen(isOpen);
        }}
        onAvailabilityInvalidated={() =>
          invalidateProviderVerification(PROVIDER_CHATGPT)
        }
      />

      <Card className="card-engines">
        <ProviderCards
          settings={settings}
          refreshKey={providerCardsRefreshKey}
          chromeAiRuntimeState={chromeAiRuntimeState}
          onSwitch={switchProvider}
          onConfigure={openProviderSettings}
          onRemove={removeProvider}
          onAdd={openAddProvider}
          canAdd={availableProviders.length > 0}
        />
      </Card>

      <div className="card">
        <h2>翻译偏好</h2>
        <div className="field">
          <label htmlFor={FIELD_IDS.translateTargetLang}>默认翻译语言</label>
          <select
            id={FIELD_IDS.translateTargetLang}
            className="select"
            value={settings.translateTargetLang}
            onChange={(event) => {
              updateSettings(
                (previous) => ({
                  ...previous,
                  translateTargetLang: event.target.value,
                  verifiedProviders: (
                    previous.verifiedProviders || []
                  ).filter(
                    (provider) => provider !== PROVIDER_CHROME_AI,
                  ),
                }),
                "now",
              );
            }}
          >
            {LANG_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
