/**
 * Bangla TTS for offline assistant.
 *
 * Sherpa-onnx TTS.initialize() can SIGABRT the whole process on some
 * emulator/device builds (uncaught native abort). Speak via expo-speech
 * instead — safe, and uses bn-BD / bn-IN when the OS has a Bangla voice.
 */
import { speakBangla, stopBanglaSpeech } from "@/lib/speakBangla";
import { logMetric, markStart } from "@/lib/offline/metrics";

let speakQueue: Promise<void> = Promise.resolve();

export async function initTTS(): Promise<boolean> {
  // Intentionally no sherpa init — see file header.
  logMetric("tts.init", undefined, "expo-speech");
  return true;
}

export function isTTSReady(): boolean {
  return true;
}

export async function speakOffline(
  text: string,
  handlers?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  },
): Promise<void> {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 3900);
  if (!cleaned) {
    handlers?.onDone?.();
    return;
  }
  const end = markStart("tts.speak");
  try {
    await speakBangla(cleaned, handlers);
    end("expo-speech");
  } catch (err) {
    end("error");
    handlers?.onError?.();
    throw err;
  }
}

/** Queue speech so sentence chunks don't overlap. */
export function streamOffline(text: string): Promise<void> {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return speakQueue;
  speakQueue = speakQueue
    .then(() => speakOffline(cleaned))
    .catch(() => undefined);
  return speakQueue;
}

export async function ensureTtsInitialized(): Promise<void> {
  await initTTS();
}

export async function stopOfflineSpeech(): Promise<void> {
  speakQueue = Promise.resolve();
  await stopBanglaSpeech().catch(() => undefined);
}
