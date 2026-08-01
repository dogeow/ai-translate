import {
  DEFAULT_MINIMAX_MODEL,
  MINIMAX_REGION_CN,
  MINIMAX_REGION_GLOBAL,
  PROVIDER_CHATGPT,
  PROVIDER_CHROME_AI,
  PROVIDER_GITHUB_MODELS,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  PROVIDER_OLLAMA,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../../shared/constants.js";
import {
  getDefaultMiniMaxApiUrlByRegion,
  isMiniMaxProvider,
  normalizeAddedProviders,
  normalizeVerifiedProviders,
} from "../../../shared/settings.js";

const PROVIDER_ICON_LABELS = Object.freeze({
  [PROVIDER_OLLAMA]: "O",
  [PROVIDER_MINIMAX_CN]: "M",
  [PROVIDER_MINIMAX_GLOBAL]: "M",
  [PROVIDER_GITHUB_MODELS]: "GH",
  [PROVIDER_CHATGPT]: "AI",
  [PROVIDER_CHROME_AI]: "C",
});

export function getProviderLabel(provider) {
  return (
    TRANSLATE_PROVIDER_OPTIONS.find((option) => option.value === provider)
      ?.label || provider
  );
}

export function getProviderIconLabel(provider) {
  return PROVIDER_ICON_LABELS[provider] || "AI";
}

export function getAddedProviders(settings) {
  return normalizeAddedProviders(
    settings?.addedProviders,
    settings?.provider,
  );
}

export function getAvailableProviders(settings) {
  const added = new Set(getAddedProviders(settings));
  return TRANSLATE_PROVIDER_OPTIONS.filter(
    (option) => !added.has(option.value),
  );
}

export function buildProviderDraft(settings, provider) {
  const draft = {
    ...settings,
    addedProviders: [...getAddedProviders(settings)],
    provider,
  };

  if (
    provider === PROVIDER_MINIMAX_CN ||
    provider === PROVIDER_MINIMAX_GLOBAL
  ) {
    const region =
      provider === PROVIDER_MINIMAX_GLOBAL
        ? MINIMAX_REGION_GLOBAL
        : MINIMAX_REGION_CN;
    draft.minimaxRegion = region;
    if (settings.provider !== provider) {
      draft.minimaxApiUrl = getDefaultMiniMaxApiUrlByRegion(region);
    }
  }

  return draft;
}

export function buildActivatedProviderSettings(settings, provider) {
  const next = {
    ...settings,
    provider,
    addedProviders: Array.from(
      new Set([...getAddedProviders(settings), provider]),
    ),
  };

  if (
    provider === PROVIDER_MINIMAX_CN ||
    provider === PROVIDER_MINIMAX_GLOBAL
  ) {
    const region =
      provider === PROVIDER_MINIMAX_GLOBAL
        ? MINIMAX_REGION_GLOBAL
        : MINIMAX_REGION_CN;
    next.minimaxRegion = region;
    next.minimaxApiUrl = getDefaultMiniMaxApiUrlByRegion(region);
  }

  return next;
}

export function buildRemovedProviderSettings(settings, provider) {
  const addedProviders = getAddedProviders(settings).filter(
    (item) => item !== provider,
  );
  const verifiedProviders = normalizeVerifiedProviders(
    settings.verifiedProviders,
    addedProviders,
  );
  const baseSettings = {
    ...settings,
    addedProviders,
    verifiedProviders,
  };

  if (settings.provider !== provider || addedProviders.length === 0) {
    return baseSettings;
  }

  const nextProvider =
    addedProviders.find((item) => verifiedProviders.includes(item)) ||
    addedProviders[0];
  return {
    ...buildActivatedProviderSettings(baseSettings, nextProvider),
    addedProviders,
    verifiedProviders,
  };
}

function getProviderConfigurationFingerprint(provider, settings) {
  if (provider === PROVIDER_OLLAMA) {
    return JSON.stringify([settings.ollamaUrl, settings.ollamaModel]);
  }
  if (
    provider === PROVIDER_MINIMAX_CN ||
    provider === PROVIDER_MINIMAX_GLOBAL
  ) {
    return JSON.stringify([
      settings.minimaxApiUrl,
      settings.minimaxModel,
      provider === PROVIDER_MINIMAX_GLOBAL
        ? settings.minimaxApiKeyGlobal
        : settings.minimaxApiKeyCn,
    ]);
  }
  if (provider === PROVIDER_GITHUB_MODELS) {
    return JSON.stringify([
      settings.githubApiUrl,
      settings.githubDeviceToken,
      settings.githubOAuthClientId,
      settings.githubModel,
    ]);
  }
  if (provider === PROVIDER_CHATGPT) {
    return JSON.stringify([settings.chatgptModel]);
  }
  return JSON.stringify([settings.translateTargetLang]);
}

export function buildSavedProviderSettings(
  settings,
  draft,
  isAdding,
  connectionVerified = false,
  connectionTested = false,
) {
  const activeProvider = settings.provider;
  const next = {
    ...settings,
    ...draft,
    addedProviders: Array.from(
      new Set([...getAddedProviders(settings), draft.provider]),
    ),
    provider: isAdding ? draft.provider : activeProvider,
  };
  const verifiedProviders = new Set(
    normalizeVerifiedProviders(
      settings.verifiedProviders,
      next.addedProviders,
    ),
  );
  const configurationChanged =
    getProviderConfigurationFingerprint(draft.provider, settings) !==
    getProviderConfigurationFingerprint(draft.provider, draft);
  if (connectionVerified) {
    verifiedProviders.add(draft.provider);
  } else if (connectionTested || configurationChanged) {
    verifiedProviders.delete(draft.provider);
  }
  next.verifiedProviders = Array.from(verifiedProviders);

  if (
    !isAdding &&
    draft.provider !== activeProvider &&
    isMiniMaxProvider(draft.provider) &&
    isMiniMaxProvider(activeProvider)
  ) {
    next.minimaxRegion = settings.minimaxRegion;
    next.minimaxApiUrl = settings.minimaxApiUrl;
  }

  return next;
}

export function getProviderCardMeta(
  provider,
  settings,
  chatGptLoggedIn = false,
  chromeAiRuntimeState = "unknown",
) {
  const isVerified = (settings.verifiedProviders || []).includes(provider);
  if (provider === PROVIDER_MINIMAX_CN) {
    const isConfigured = Boolean(settings.minimaxApiKeyCn);
    return {
      detail: settings.minimaxModel || DEFAULT_MINIMAX_MODEL,
      status: !isConfigured
        ? "待配置"
        : isVerified
          ? "已验证"
          : "待验证",
      ready: isConfigured && isVerified,
    };
  }
  if (provider === PROVIDER_MINIMAX_GLOBAL) {
    const isConfigured = Boolean(settings.minimaxApiKeyGlobal);
    return {
      detail: settings.minimaxModel || DEFAULT_MINIMAX_MODEL,
      status: !isConfigured
        ? "待配置"
        : isVerified
          ? "已验证"
          : "待验证",
      ready: isConfigured && isVerified,
    };
  }
  if (provider === PROVIDER_GITHUB_MODELS) {
    const isConfigured = Boolean(settings.githubDeviceToken);
    return {
      detail: settings.githubModel,
      status: !isConfigured
        ? "待登录"
        : isVerified
          ? "已验证"
          : "待验证",
      ready: isConfigured && isVerified,
    };
  }
  if (provider === PROVIDER_CHATGPT) {
    return {
      detail: settings.chatgptModel,
      status: !chatGptLoggedIn
        ? "待登录"
        : isVerified
          ? "已验证"
          : "待验证",
      ready: chatGptLoggedIn && isVerified,
    };
  }
  if (provider === PROVIDER_CHROME_AI) {
    if (chromeAiRuntimeState === "checking") {
      return {
        detail: "浏览器内置模型",
        status: "检测中",
        ready: false,
      };
    }
    if (chromeAiRuntimeState === "ready") {
      return {
        detail: "浏览器内置模型",
        status: "已就绪",
        ready: true,
      };
    }
    if (chromeAiRuntimeState === "unavailable") {
      return {
        detail: "浏览器内置模型",
        status: "当前不可用",
        ready: false,
      };
    }
    return {
      detail: "浏览器内置模型",
      status: isVerified ? "已验证" : "待验证",
      ready: isVerified,
    };
  }
  const isConfigured = Boolean(settings.ollamaModel);
  return {
    detail: settings.ollamaModel || "本地 Ollama",
    status: !isConfigured
      ? "待选择模型"
      : isVerified
        ? "已验证"
        : "待验证",
    ready: isConfigured && isVerified,
  };
}
