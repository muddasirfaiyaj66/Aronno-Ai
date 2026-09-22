/**
 * Offline Bangla TTS via sherpa-onnx, with expo-speech fallback (speakBangla).
 */
import { NativeModules } from "react-native";
import { speakBangla as speakWithOS } from "@/lib/speakBangla";
import { catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import { logMetric, markStart } from "@/lib/offline/metrics";

type SherpaTTSModule = {
  init: (opts: { modelDir: string }) => Promise<void>;
  speak: (text: string) => Promise<void>;
};

const SherpaTTS = NativeModules.SherpaTTS as SherpaTTSModule | undefined;
let ready = false;
let speakQueue: Promise<void> = Promise.resolve();

export async function initTTS(): Promise<boolean> {
  const end = markStart("tts.init");
  const entry = catalogByKind("tts")[0];
  if (!entry || !(await isInstalled(entry))) {
    ready = false;
    end("model-not-downloaded");
    return false;
  }
  if (!SherpaTTS) {
    ready = false;
    end("native-module-missing");
    return false;
  }
  try {
    await SherpaTTS.init({ modelDir: localDir(entry) });
    ready = true;
    end("ok");
    return true;
  } catch {
    ready = false;
    end("init-failed");
    return false;
  }
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
  const end = markStart("tts.speak");
  try {
    if (ready && SherpaTTS) {
      await SherpaTTS.speak(cleaned);
      handlers?.onDone?.();
      end("sherpa");
      return;
    }
    await speakWithOS(cleaned, handlers);
    end("expo-speech");
  } catch (err) {
    end("error");
    handlers?.onError?.();
    throw err;
  }
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

export async function ensureTtsInitialized(): Promise<void> {
  if (!ready) await initTTS();
  logMetric("tts.ensure", undefined, ready ? "ready" : "fallback-os");
}
