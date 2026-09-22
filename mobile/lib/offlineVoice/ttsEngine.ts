/**
 * Offline Bangla TTS via sherpa-onnx, with expo-speech fallback (speakBangla).
 * streamOffline flushes sentence chunks as the LLM generates tokens.
 */
import { speakBangla as speakWithOS } from "@/lib/speakBangla";

let ready = false;
let speakQueue: Promise<void> = Promise.resolve();

export async function initTTS(_opts?: { modelDir: string }): Promise<void> {
  // TODO(Sprint 1): SherpaTTS.init(...)
  ready = false;
}

export function isTTSReady(): boolean {
  return ready;
}

export async function speakOffline(
  text: string,
  handlers?: { onDone?: () => void; onStopped?: () => void; onError?: () => void },
): Promise<void> {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 3900);
  if (!cleaned) {
    handlers?.onDone?.();
    return;
  }
  if (ready) {
    // TODO(Sprint 1): await SherpaTTS.speak(cleaned)
  }
  await speakWithOS(cleaned, handlers);
}

/** Queue sentence chunks so streaming LLM output speaks in order. */
export function streamOffline(text: string): Promise<void> {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return speakQueue;
  speakQueue = speakQueue
    .then(() => speakOffline(cleaned))
    .catch(() => undefined);
  return speakQueue;
}
