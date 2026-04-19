import { useCallback, useRef, useState } from "react";
import { getConfig } from "../lib/utils.js";
import {
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_GITHUB_MODEL,
} from "../../shared/constants.js";
import {
  fetchMiniMaxModels,
  testMiniMaxConnection,
} from "../../shared/minimax-api.js";
import {
  isMiniMaxGlobalApiUrl,
  isMiniMaxProvider,
  isGitHubModelsProvider,
} from "../../shared/settings.js";
import { filterTranslationModels } from "../../shared/model-utils.js";
import { fetchGitHubModels } from "../../shared/github-models-api.js";

/**
 * 管理翻译提供商连接状态的 hook
 * 处理 Ollama / MiniMax 连接检测、模型列表获取和 403 错误弹窗
 */
export function useConnectionStatus({
  settingsRef,
  updateSettings,
  persistSettings,
}) {
  const [connectionStatus, setConnectionStatus] = useState({
    kind: "pending",
    text: "检测中…",
    showAction: false,
  });
  const [models, setModels] = useState([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [originsModalOpen, setOriginsModalOpen] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState({
    text: "",
    tone: "",
    showAction: false,
  });
  const connectionRequestIdRef = useRef(0);

  function formatErrorMessage(error) {
    return (error.message || String(error)) === "Failed to fetch"
      ? "Ollama 连接失败"
      : error.message || String(error);
  }

  function getMiniMaxModels(fallbackModel = DEFAULT_MINIMAX_MODEL) {
    return [{ name: fallbackModel || DEFAULT_MINIMAX_MODEL }];
  }

  function getMiniMaxRegionLabel(apiBaseUrl) {
    return isMiniMaxGlobalApiUrl(apiBaseUrl) ? "国外" : "国内";
  }

  function getGitHubModelsList(fallbackModel = DEFAULT_GITHUB_MODEL) {
    return [{ name: fallbackModel || DEFAULT_GITHUB_MODEL }];
  }

  function applyConnectionStatus(nextStatus, updateBannerStatus) {
    if (!updateBannerStatus) return;
    setConnectionStatus(nextStatus);
  }

  function handle403({ preserveTestMessage, updateBannerStatus }) {
    applyConnectionStatus(
      {
        kind: "403",
        text: "Ollama 已运行，但拒绝扩展请求（403）",
        showAction: true,
      },
      updateBannerStatus,
    );
    setModels([]);
    if (!preserveTestMessage) {
      setTestConnectionResult({
        text: "Ollama 已运行，但拒绝扩展请求（403）",
        tone: "err",
        showAction: true,
      });
    }
  }

  const updateConnectionStatus = useCallback(
    async (nextSettings, options = {}) => {
      const {
        preserveTestMessage = false,
        suppressTestMessageOnMissingKey = false,
        updateBannerStatus = true,
        showTestPending = false,
      } = options;
      const requestId = ++connectionRequestIdRef.current;
      const provider = getConfig(nextSettings).provider;
      const providerLabel = isMiniMaxProvider(provider)
        ? "MiniMax"
        : isGitHubModelsProvider(provider)
          ? "GitHub Models"
          : "Ollama";
      applyConnectionStatus(
        {
          kind: "pending",
          text: `检测 ${providerLabel} 连接中…`,
          showAction: false,
        },
        updateBannerStatus,
      );
      if (!preserveTestMessage) {
        setTestConnectionResult({
          text: showTestPending ? `检测 ${providerLabel} 连接中…` : "",
          tone: "",
          showAction: false,
        });
      }
      setModelDropdownOpen(false);

      const { base, model, apiKey, apiKeyLabel } = getConfig(nextSettings);

      if (isMiniMaxProvider(provider)) {
        const fallbackModel =
          nextSettings.minimaxModel || DEFAULT_MINIMAX_MODEL;
        const regionLabel = getMiniMaxRegionLabel(base);
        let minimaxModels = getMiniMaxModels(fallbackModel);
        let fetchedFromApi = false;

        if (!apiKey) {
          applyConnectionStatus(
            {
              kind: "err",
              text: `${apiKeyLabel || "MiniMax API Key"} 未填写`,
              showAction: false,
            },
            updateBannerStatus,
          );
          setModels(minimaxModels);
          if (!preserveTestMessage && !suppressTestMessageOnMissingKey) {
            setTestConnectionResult({
              text: `请先填写${apiKeyLabel || "MiniMax API Key"}`,
              tone: "err",
              showAction: false,
            });
          }
          setOriginsModalOpen(false);
          return;
        }

        try {
          try {
            const remoteModelNames = await fetchMiniMaxModels(base, apiKey);
            if (requestId !== connectionRequestIdRef.current) return;
            if (remoteModelNames.length > 0) {
              minimaxModels = remoteModelNames.map((name) => ({ name }));
              fetchedFromApi = true;
            }
          } catch (_) {}

          await testMiniMaxConnection(base, apiKey, model || fallbackModel);
          if (requestId !== connectionRequestIdRef.current) return;

          applyConnectionStatus(
            {
              kind: "ok",
              text: `MiniMax（${regionLabel}）已连接`,
              showAction: false,
            },
            updateBannerStatus,
          );
          setModels(minimaxModels);
          setOriginsModalOpen(false);

          if (!preserveTestMessage) {
            setTestConnectionResult({
              text: fetchedFromApi
                ? `连接成功，已获取 ${minimaxModels.length} 个模型`
                : "连接成功，已使用默认模型",
              tone: "ok",
              showAction: false,
            });
          }
        } catch (error) {
          if (requestId !== connectionRequestIdRef.current) return;
          applyConnectionStatus(
            {
              kind: "err",
              text: "MiniMax 未连接",
              showAction: false,
            },
            updateBannerStatus,
          );
          setModels(minimaxModels);
          if (!preserveTestMessage) {
            setTestConnectionResult({
              text: error.message || String(error),
              tone: "err",
              showAction: false,
            });
          }
          setOriginsModalOpen(false);
        }
        return;
      }

      if (isGitHubModelsProvider(provider)) {
        const fallbackModel = nextSettings.githubModel || DEFAULT_GITHUB_MODEL;
        let githubModels = getGitHubModelsList(fallbackModel);
        let fetchedFromApi = false;

        if (!apiKey) {
          applyConnectionStatus(
            {
              kind: "err",
              text: `${apiKeyLabel || "GitHub 访问令牌"} 未填写`,
              showAction: false,
            },
            updateBannerStatus,
          );
          setModels(githubModels);
          if (!preserveTestMessage) {
            setTestConnectionResult({
              text: `请先填写${apiKeyLabel || "GitHub 访问令牌"}`,
              tone: "err",
              showAction: false,
            });
          }
          return;
        }

        try {
          const remoteModelNames = await fetchGitHubModels(base, apiKey, {
            forceRefresh: showTestPending,
          });
          if (requestId !== connectionRequestIdRef.current) return;
          if (remoteModelNames.length > 0) {
            githubModels = remoteModelNames.map((name) => ({ name }));
            fetchedFromApi = true;
          }

          applyConnectionStatus(
            {
              kind: "ok",
              text: "GitHub Models 已连接",
              showAction: false,
            },
            updateBannerStatus,
          );
          setModels(githubModels);

          if (!preserveTestMessage) {
            setTestConnectionResult({
              text: fetchedFromApi
                ? `连接成功，已获取 ${githubModels.length} 个模型`
                : "连接成功，已使用默认模型",
              tone: "ok",
              showAction: false,
            });
          }
        } catch (error) {
          if (requestId !== connectionRequestIdRef.current) return;
          applyConnectionStatus(
            {
              kind: "err",
              text: "GitHub Models 未连接",
              showAction: false,
            },
            updateBannerStatus,
          );
          setModels(githubModels);
          if (!preserveTestMessage) {
            setTestConnectionResult({
              text: error.message || String(error),
              tone: "err",
              showAction: false,
            });
          }
        }
        return;
      }

      try {
        const tagsResponse = await fetch(`${base}/api/tags`, { method: "GET" });
        if (requestId !== connectionRequestIdRef.current) return;

        if (tagsResponse.status === 403) {
          handle403({
            preserveTestMessage,
            updateBannerStatus,
          });
          return;
        }

        if (!tagsResponse.ok) {
          throw new Error(`HTTP ${tagsResponse.status}`);
        }

        const tagsData = await tagsResponse.json();
        const nextModels = filterTranslationModels(tagsData.models || []);
        const probeResponse = await fetch(`${base}/api/__probe_origin__`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });

        if (requestId !== connectionRequestIdRef.current) return;

        if (probeResponse.status === 403) {
          handle403({
            preserveTestMessage,
            updateBannerStatus,
          });
          return;
        }

        applyConnectionStatus(
          {
            kind: "ok",
            text: "Ollama 已运行",
            showAction: false,
          },
          updateBannerStatus,
        );
        setModels(nextModels);
        setOriginsModalOpen(false);

        if (!preserveTestMessage) {
          setTestConnectionResult({
            text:
              nextModels.length > 0
                ? `连接成功，已拉取 ${nextModels.length} 个模型`
                : "连接成功，但未找到已拉取的模型",
            tone: "ok",
            showAction: false,
          });
        }
      } catch (error) {
        if (requestId !== connectionRequestIdRef.current) return;
        applyConnectionStatus(
          {
            kind: "err",
            text: "Ollama 未连接",
            showAction: true,
          },
          updateBannerStatus,
        );
        setModels([]);
        if (!preserveTestMessage) {
          setTestConnectionResult({
            text: formatErrorMessage(error),
            tone: "err",
            showAction: true,
          });
        }
      }
    },
    [settingsRef, updateSettings, persistSettings],
  );

  return {
    connectionStatus,
    setConnectionStatus,
    models,
    modelDropdownOpen,
    setModelDropdownOpen,
    originsModalOpen,
    setOriginsModalOpen,
    testConnectionResult,
    updateConnectionStatus,
  };
}
