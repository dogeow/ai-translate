import {
  generateOllamaResponse,
  generateOllamaStreamingResponse,
} from "./ollama.js";
import { getOllamaErrorMessage } from "../shared/ollama-errors.js";
import {
  isMiniMaxProvider,
  isGitHubModelsProvider,
  isChromeAiProvider,
} from "../shared/settings.js";
import {
  generateMiniMaxCompletion,
  generateMiniMaxStreamingCompletion,
} from "../shared/minimax-api.js";
import {
  generateGitHubModelsCompletion,
  generateGitHubModelsStreamingCompletion,
} from "../shared/github-models-api.js";
import {
  generateChromeAiCompletion,
  generateChromeAiStreamingCompletion,
} from "../shared/chrome-ai-api.js";

export async function runProviderCompletion({
  provider,
  base,
  model,
  apiKey,
  prompt,
  text,
  targetLang,
}) {
  if (isChromeAiProvider(provider)) {
    return generateChromeAiCompletion(text, targetLang);
  }
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
  text,
  targetLang,
  onChunk,
}) {
  if (isChromeAiProvider(provider)) {
    return generateChromeAiStreamingCompletion(text, targetLang, { onChunk });
  }
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
  if (
    isChromeAiProvider(provider) ||
    isMiniMaxProvider(provider) ||
    isGitHubModelsProvider(provider)
  ) {
    return error?.message || String(error);
  }
  return getOllamaErrorMessage(error, { detailed: true });
}
