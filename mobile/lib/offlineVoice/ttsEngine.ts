/**
 * Offline Bangla TTS via @siteed/sherpa-onnx.rn (VITS coqui BN),
 * with expo-speech fallback (speakBangla).
 */
import { Audio } from "expo-av";
import { TTS } from "@siteed/sherpa-onnx.rn";
import type { TtsModelConfig } from "@siteed/sherpa-onnx.rn";
import { catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import { speakBangla as speakWithOS } from "@/lib/speakBangla";
import { logMetric, markStart } from "@/lib/offline/metrics";

let ready = false;
let speakQueue: Promise<void> = Promise.resolve();
let sound: Audio.Sound | null = null;

function nativePath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

export async function initTTS(): Promise<boolean> {
  const end = markStart("tts.init");
  const entry = catalogByKind("tts")[0];
  if (!entry || !(await isInstalled(entry))) {
    ready = false;
    end("model-not-downloaded");
    return false;
  }
  try {
    const config: TtsModelConfig = {
      modelDir: nativePath(localDir(entry)),
      ttsModelType: "vits",
      modelFile: "model.onnx",
      tokensFile: "tokens.txt",
      numThreads: 2,
    };
    const result = await TTS.initialize(config);
    if (!result.success) {
      ready = false;
      end(result.error ?? "init-failed");
      return false;
    }
    ready = true;
    end("ok");
    return true;
  } catch (err) {
    ready = false;
    end(err instanceof Error ? err.message : "init-failed");
    return false;
  }
}

export function isTTSReady(): boolean {
  return ready;
}

async function playFile(path: string): Promise<void> {
  if (sound) {
    await sound.unloadAsync().catch(() => undefined);
    sound = null;
  }
  const uri = path.startsWith("file://") ? path : `file://${path}`;
  const { sound: s } = await Audio.Sound.createAsync({ uri });
  sound = s;
  await new Promise<void>((resolve, reject) => {
    s.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) resolve();
    });
    s.playAsync().catch(reject);
  });
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
    if (!ready) await initTTS();
    if (ready) {
      const result = await TTS.generateSpeech(cleaned, {
        speakerId: 0,
        speakingRate: 1,
        playAudio: false,
      });
      if (result.success && result.filePath) {
        await playFile(result.filePath);
        handlers?.onDone?.();
        end("sherpa");
        return;
      }
      await TTS.generateSpeech(cleaned, {
        speakerId: 0,
        speakingRate: 1,
        playAudio: true,
      });
      handlers?.onDone?.();
      end("sherpa-play");
      return;
    }
    await speakWithOS(cleaned, handlers);
    end("expo-speech");
  } catch (err) {
    try {
      await speakWithOS(cleaned, handlers);
      end("expo-speech-fallback");
    } catch {
      end("error");
      handlers?.onError?.();
      throw err;
    }
  }
}

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
