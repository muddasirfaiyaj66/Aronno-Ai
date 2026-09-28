/**
 * Bangla TTS: prefer on-device sherpa VITS when downloaded; otherwise
 * expo-speech (OS Bangla voice). Sherpa TTS.initialize can SIGABRT on some
 * devices — crash guard skips native TTS after a failed mid-init launch.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { catalogById, catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import {
  prepareSpeechText,
  speakBangla,
  stopBanglaSpeech,
} from "@/lib/speakBangla";
import { enablePlaybackAudio } from "@/lib/speechRecording";
import { logMetric, markStart } from "@/lib/offline/metrics";

const TTS_INITING = "aronno.sherpa.tts.initing";
const TTS_BAD = "aronno.sherpa.tts.bad";
const TTS_ENTRY_ID = "tts-bn-vits-coqui";

let sherpaReady = false;
let sherpaDisabled = false;
let speakQueue: Promise<void> = Promise.resolve();
let playingSound: Audio.Sound | null = null;
let speakGen = 0;

type TtsApi = {
  initialize: (config: Record<string, unknown>) => Promise<{
    success: boolean;
    error?: string;
    sampleRate?: number;
  }>;
  generateSpeech: (
    text: string,
    options?: {
      speakerId?: number;
      speakingRate?: number;
      playAudio?: boolean;
    },
  ) => Promise<{ success: boolean; filePath?: string }>;
  release: () => Promise<{ released: boolean }>;
};

let ttsApi: TtsApi | null = null;

function nativePath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

async function loadCrashGuard(): Promise<void> {
  try {
    const initing = await AsyncStorage.getItem(TTS_INITING);
    if (initing === "1") {
      sherpaDisabled = true;
      await AsyncStorage.setItem(TTS_BAD, "1").catch(() => undefined);
      await AsyncStorage.removeItem(TTS_INITING).catch(() => undefined);
      logMetric("tts.sherpa.disabled", undefined, "prior-crash");
    } else if ((await AsyncStorage.getItem(TTS_BAD)) === "1") {
      sherpaDisabled = true;
    }
  } catch {
    // ignore
  }
}

export async function resetTtsCrashGuard(): Promise<void> {
  sherpaDisabled = false;
  sherpaReady = false;
  ttsApi = null;
  await AsyncStorage.multiRemove([TTS_INITING, TTS_BAD]).catch(() => undefined);
}

async function getTTS(): Promise<TtsApi | null> {
  if (sherpaDisabled) return null;
  if (ttsApi) return ttsApi;
  try {
    const mod = await import("@siteed/sherpa-onnx.rn");
    ttsApi = mod.TTS as unknown as TtsApi;
    return ttsApi;
  } catch {
    sherpaDisabled = true;
    return null;
  }
}

export async function hasOfflineTtsFiles(): Promise<boolean> {
  const entry = catalogById(TTS_ENTRY_ID) ?? catalogByKind("tts")[0];
  if (!entry) return false;
  return isInstalled(entry);
}

/**
 * Warm sherpa VITS when files exist. Always returns true because expo-speech
 * remains a working fallback.
 */
export async function initTTS(opts?: { force?: boolean }): Promise<boolean> {
  const end = markStart("tts.init");
  if (opts?.force) await resetTtsCrashGuard();
  else await loadCrashGuard();

  if (sherpaReady) {
    end("sherpa-ready");
    return true;
  }
  if (sherpaDisabled) {
    end("expo-speech-fallback");
    return true;
  }

  const entry = catalogById(TTS_ENTRY_ID) ?? catalogByKind("tts")[0];
  if (!entry || !(await isInstalled(entry))) {
    end("expo-speech-no-model");
    return true;
  }

  try {
    await AsyncStorage.setItem(TTS_INITING, "1");
    const TTS = await getTTS();
    if (!TTS) {
      await AsyncStorage.removeItem(TTS_INITING).catch(() => undefined);
      end("no-native");
      return true;
    }
    const result = await TTS.initialize({
      modelDir: nativePath(localDir(entry)),
      ttsModelType: "vits",
      modelFile: "model.onnx",
      tokensFile: "tokens.txt",
      numThreads: 2,
    });
    await AsyncStorage.removeItem(TTS_INITING).catch(() => undefined);
    if (!result.success) {
      end(result.error ?? "init-failed");
      return true;
    }
    sherpaReady = true;
    end("sherpa-ok");
    return true;
  } catch (err) {
    await AsyncStorage.removeItem(TTS_INITING).catch(() => undefined);
    end(err instanceof Error ? err.message : "init-failed");
    return true;
  }
}

export function isTTSReady(): boolean {
  return true;
}

export function isSherpaTtsReady(): boolean {
  return sherpaReady;
}

async function stopPlayingSound() {
  const sound = playingSound;
  playingSound = null;
  if (!sound) return;
  try {
    await sound.stopAsync();
  } catch {
    // ignore
  }
  try {
    await sound.unloadAsync();
  } catch {
    // ignore
  }
}

/** First sentence starts quickly; the rest is synthesized while it plays. */
function speechPlan(text: string): string[] {
  const parts = text
    .split(/(?<=[।!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [text];
  const first = parts[0];
  const rest = parts.slice(1).join(" ");
  if (rest.length <= 240) return [first, rest];
  const mid = Math.ceil(parts.length / 2);
  return [first, parts.slice(1, mid).join(" "), parts.slice(mid).join(" ")].filter(
    Boolean,
  );
}

async function synthesizeSherpa(
  TTS: TtsApi,
  text: string,
): Promise<string | null> {
  const result = await TTS.generateSpeech(text, {
    speakingRate: 1.05,
    playAudio: false,
  });
  if (!result.success || !result.filePath) return null;
  return result.filePath.startsWith("file:")
    ? result.filePath
    : `file://${result.filePath}`;
}

async function playFile(uri: string, gen: number): Promise<void> {
  if (gen !== speakGen) return;
  await stopPlayingSound();
  if (gen !== speakGen) return;
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, progressUpdateIntervalMillis: 80 },
  );
  if (gen !== speakGen) {
    await sound.unloadAsync().catch(() => undefined);
    return;
  }
  playingSound = sound;
  await new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (gen !== speakGen) {
        resolve();
        return;
      }
      if (!status.isLoaded) {
        if ("error" in status && status.error) {
          reject(new Error(String(status.error)));
        }
        return;
      }
      if (status.didJustFinish) resolve();
    });
  });
}

async function speakWithSherpa(
  text: string,
  handlers?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  },
): Promise<boolean> {
  const TTS = await getTTS();
  if (!TTS || !sherpaReady) return false;
  const gen = speakGen;
  const plan = speechPlan(text);
  try {
    await enablePlaybackAudio();
    let upcoming = synthesizeSherpa(TTS, plan[0]);
    for (let i = 0; i < plan.length; i++) {
      if (gen !== speakGen) {
        handlers?.onStopped?.();
        return true;
      }
      const uri = await upcoming;
      if (!uri) return false;
      if (i + 1 < plan.length) {
        upcoming = synthesizeSherpa(TTS, plan[i + 1]);
      }
      await playFile(uri, gen);
    }
    if (gen !== speakGen) {
      handlers?.onStopped?.();
      return true;
    }
    await stopPlayingSound();
    handlers?.onDone?.();
    return true;
  } catch {
    await stopPlayingSound();
    handlers?.onError?.();
    return false;
  }
}

export async function speakOffline(
  text: string,
  handlers?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  },
): Promise<void> {
  const prepared = prepareSpeechText(text);
  if (!prepared) {
    handlers?.onDone?.();
    return;
  }
  const end = markStart("tts.speak");

  if (!sherpaReady && !sherpaDisabled) {
    await initTTS();
  }

  if (sherpaReady) {
    const ok = await speakWithSherpa(prepared, handlers);
    if (ok) {
      end("sherpa");
      return;
    }
    end("sherpa-fail-fallback");
  }

  try {
    await speakBangla(prepared, handlers);
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
  speakGen += 1;
  speakQueue = Promise.resolve();
  await stopPlayingSound();
  await stopBanglaSpeech().catch(() => undefined);
}
