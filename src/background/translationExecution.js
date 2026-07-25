import { runProviderStreaming } from "./translationProviders.js";
import {
  mergeThinking,
  splitThinkingFromText,
} from "../shared/utils/textProcessing.js";

export async function executeStreamingTranslation({
  providerRuntime,
  prompt,
  text,
  onProgress,
}) {
  let translation = "";
  let thinking = "";
  let downloadProgress = null;

  const streamed = await runProviderStreaming({
    provider: providerRuntime.provider,
    base: providerRuntime.base,
    model: providerRuntime.selectedModel,
    apiKey: providerRuntime.apiKey,
    prompt,
    text,
    targetLang: providerRuntime.targetLang,
    onChunk: (chunk) => {
      const parsed = splitThinkingFromText(chunk.response || "");
      translation = parsed.translation;
      thinking = mergeThinking(chunk.thinking || "", parsed.thinking);
      if (typeof chunk.downloadProgress === "number") {
        downloadProgress = chunk.downloadProgress;
      }
      onProgress?.({ translation, thinking, downloadProgress });
    },
  });

  const parsedFinal = splitThinkingFromText(streamed.response || translation);
  return {
    translation: parsedFinal.translation,
    thinking: mergeThinking(
      streamed.thinking || thinking,
      parsedFinal.thinking,
    ),
    downloadProgress,
  };
}
