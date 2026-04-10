import {
  generateOllamaResponse,
  generateOllamaStreamingResponse,
} from "./ollama.js";
import { getOllamaErrorMessage } from "../shared/ollama-errors.js";
import {
  isMiniMaxProvider,
  isGitHubModelsProvider,
} from "../shared/settings.js";
import {
  generateMiniMaxCompletion,
  generateMiniMaxStreamingCompletion,
} from "../shared/minimax-api.js";
import {
  generateGitHubModelsCompletion,
  generateGitHubModelsStreamingCompletion,
} from "../shared/github-models-api.js";

export async function runProviderCompletion({
  provider,
  base,
  model,
  apiKey,
  prompt,
}) {
  if (isMiniMaxProvider(provider)) {
    return generateMiniMaxCompletion(base, apiKey, model, prompt);
  }
  if (isGitHubModelsProvider(provider)) {
    return generateGitHubModelsCompletion(base, apiKey, model, prompt);
  }
  return generateOllamaResponse(base, model, prompt);
}

export async function runProviderStreaming({
  provider,
  base,
  model,
  apiKey,
  prompt,
  onChunk,
}) {
  if (isMiniMaxProvider(provider)) {
    return generateMiniMaxStreamingCompletion(base, apiKey, model, prompt, {
      onChunk,
    });
  }
  if (isGitHubModelsProvider(provider)) {
    return generateGitHubModelsStreamingCompletion(base, apiKey, model, prompt, {
      onChunk,
    });
  }
  return generateOllamaStreamingResponse(base, model, prompt, { onChunk });
}

export function toProviderError(provider, error) {
  if (isMiniMaxProvider(provider) || isGitHubModelsProvider(provider)) {
    return error?.message || String(error);
  }
  return getOllamaErrorMessage(error, { detailed: true });
}
