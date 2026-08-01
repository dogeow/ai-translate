import { buildYoudaoAudioUrl } from "../../../shared/youdao-api.js";

function playAudio(word, type) {
  try {
    const audio = new Audio(buildYoudaoAudioUrl(word, type));
    audio.play().catch(() => {});
  } catch (_) {}
}

export function PronunciationLinks({ word }) {
  return (
    <span className="word-learning-pronunciations">
      <button
        type="button"
        className="word-learning-pronunciation"
        aria-label={`播放 ${word} 的英式发音`}
        title="播放英式发音"
        onClick={() => playAudio(word, 1)}
      >
        UK <span aria-hidden="true">▶</span>
      </button>
      <button
        type="button"
        className="word-learning-pronunciation"
        aria-label={`播放 ${word} 的美式发音`}
        title="播放美式发音"
        onClick={() => playAudio(word, 2)}
      >
        US <span aria-hidden="true">▶</span>
      </button>
    </span>
  );
}
