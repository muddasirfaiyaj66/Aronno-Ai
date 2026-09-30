/**
 * Bangla TTS: Gemini female voice online, then on-device Piper (Sherpa-ONNX)
 * female speaker, then the phone's female Bangla voice. Sherpa TTS.initialize
 * can SIGABRT on some devices — crash guard skips native TTS after a failed
 * mid-init launch.
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
import {
  PIPER_BN_TOKENS,
  PIPER_ESPEAK_ARCHIVE,
  PIPER_ESPEAK_DIR,
  PIPER_FEMALE_SPEAKER,
  PIPER_META_SUFFIX,
  PIPER_MODEL_FILE,
  PIPER_ONNX_BYTES,
  PIPER_TOKENS_FILE,
} from "@/lib/offlineVoice/piperBn";

const TTS_INITING = "aronno.sherpa.tts.initing";
const TTS_BAD = "aronno.sherpa.tts.bad";
const TTS_ENTRY_ID = "tts-bn-piper";

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

type ArchiveApi = {
  extractTarBz2: (
    sourcePath: string,
    targetDir: string,
  ) => Promise<{ success: boolean; message?: string }>;
};

async function getArchive(): Promise<ArchiveApi | null> {
  try {
    const mod = await import("@siteed/sherpa-onnx.rn");
    const bag = mod as {
      default?: { Archive?: ArchiveApi };
      Archive?: ArchiveApi;
    };
    return bag.default?.Archive ?? bag.Archive ?? null;
  } catch {
    return null;
  }
}

/** Write tokens, mark the onnx as Piper, and unpack espeak-ng-data. */
async function preparePiperVoice(modelDir: string): Promise<boolean> {
  const { File } = await import("expo-file-system");
  const tokens = new File(`${modelDir}${PIPER_TOKENS_FILE}`);
  if (!tokens.exists) tokens.create();
  tokens.write(PIPER_BN_TOKENS);

  const model = new File(`${modelDir}${PIPER_MODEL_FILE}`);
  const size = model.info().size ?? 0;
  const patchedSize = PIPER_ONNX_BYTES + PIPER_META_SUFFIX.byteLength;
  if (size === PIPER_ONNX_BYTES) {
    const handle = model.open();
    try {
      handle.offset = size;
      handle.writeBytes(PIPER_META_SUFFIX);
    } finally {
      handle.close();
    }
  } else if (size !== patchedSize) {
    return false;
  }

  const phontab = new File(`${modelDir}${PIPER_ESPEAK_DIR}/phontab`);
  if (phontab.exists) return true;

  const archive = await getArchive();
  if (!archive) return false;
  const extracted = await archive.extractTarBz2(
    nativePath(`${modelDir}${PIPER_ESPEAK_ARCHIVE}`),
    nativePath(modelDir),
  );
  return extracted.success && new File(`${modelDir}${PIPER_ESPEAK_DIR}/phontab`).exists;
}

/**
 * Warm sherpa Piper when files exist. Always returns true because expo-speech
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
    const modelDir = localDir(entry);
    const assetsReady = await preparePiperVoice(modelDir);
    if (!assetsReady) {
      await AsyncStorage.removeItem(TTS_INITING).catch(() => undefined);
      end("piper-assets");
      return true;
    }
    const result = await TTS.initialize({
      modelDir: nativePath(modelDir),
      ttsModelType: "vits",
      modelFile: PIPER_MODEL_FILE,
      tokensFile: PIPER_TOKENS_FILE,
      dataDir: nativePath(`${modelDir}${PIPER_ESPEAK_DIR}`),
      numThreads: 1,
      noiseScale: 0.667,
      noiseScaleW: 0.8,
      lengthScale: 1,
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

/** Keep each local clip short so a long answer stays on the female Piper voice. */
const SHERPA_CHARS = 220;

function speechPlan(text: string): string[] {
  const sentences = text
    .split(/(?<=[।!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const pieces = sentences.length ? sentences : [text];
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const next = buf.trim();
    buf = "";
    if (next) chunks.push(next);
  };

  for (const piece of pieces) {
    let rest = piece;
    while (rest) {
      const joined = buf ? `${buf} ${rest}` : rest;
      if (joined.length <= SHERPA_CHARS) {
        buf = joined;
        rest = "";
        break;
      }
      if (buf) flush();
      if (rest.length <= SHERPA_CHARS) {
        buf = rest;
        rest = "";
        break;
      }
      const window = rest.slice(0, SHERPA_CHARS);
      const cut = Math.max(
        window.lastIndexOf(" "),
        window.lastIndexOf("।"),
        window.lastIndexOf(","),
      );
      const at = cut > 40 ? cut : SHERPA_CHARS;
      chunks.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
  }
  flush();
  return chunks.length ? chunks : [text];
}

async function synthesizeSherpa(
  TTS: TtsApi,
  text: string,
): Promise<string | null> {
  const result = await TTS.generateSpeech(text, {
    speakerId: PIPER_FEMALE_SPEAKER,
    speakingRate: 1,
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
  let played = false;
  try {
    await enablePlaybackAudio();
    let upcoming = synthesizeSherpa(TTS, plan[0]);
    for (let i = 0; i < plan.length; i++) {
      if (gen !== speakGen) {
        handlers?.onStopped?.();
        return true;
      }
      let uri = await upcoming;
      if (!uri) uri = await synthesizeSherpa(TTS, plan[i]);
      if (!uri) {
        if (!played) return false;
        await speakBangla(plan.slice(i).join(" "), handlers);
        return true;
      }
      if (i + 1 < plan.length) {
        upcoming = synthesizeSherpa(TTS, plan[i + 1]);
      }
      await playFile(uri, gen);
      played = true;
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
    return played;
  }
}

/** On-device Piper female voice. Used for the whole reply, and for whatever Gemini could not finish. */
async function speakWithLocalFemale(
  text: string,
  handlers?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  },
): Promise<boolean> {
  const prepared = prepareSpeechText(text);
  if (!prepared) return true;
  if (!sherpaReady && !sherpaDisabled) await initTTS();
  if (!sherpaReady) return false;
  return speakWithSherpa(prepared, handlers);
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

  if (await speakWithCloudFemale(prepared, handlers)) {
    end("cloud-female");
    return;
  }

  if (await speakWithLocalFemale(prepared, handlers)) {
    end("sherpa");
    return;
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

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** One free Flash-Lite clip. The full answer is many of these, never one paid long call. */
const CLOUD_TTS_CHARS = 480;

function cloudSpeechChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[।!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const pieces = sentences.length ? sentences : [text];
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const next = buf.trim();
    buf = "";
    if (next) chunks.push(next);
  };

  for (const piece of pieces) {
    let rest = piece;
    while (rest) {
      const joined = buf ? `${buf} ${rest}` : rest;
      if (joined.length <= CLOUD_TTS_CHARS) {
        buf = joined;
        rest = "";
        break;
      }
      if (buf) flush();
      if (rest.length <= CLOUD_TTS_CHARS) {
        buf = rest;
        rest = "";
        break;
      }
      const window = rest.slice(0, CLOUD_TTS_CHARS);
      const cut = Math.max(window.lastIndexOf(" "), window.lastIndexOf("।"));
      const at = cut > 80 ? cut : CLOUD_TTS_CHARS;
      chunks.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
  }
  flush();
  return chunks;
}

/**
 * The free Gemini voice allows only a few clips a day. Once it refuses,
 * skip it for a while so every sentence doesn't wait on a failing call.
 */
const CLOUD_TTS_COOLDOWN_MS = 30 * 60_000;
let cloudTtsBlockedUntil = 0;

async function fetchCloudAudio(text: string): Promise<string | null> {
  if (Date.now() < cloudTtsBlockedUntil) return null;
  const clip = text.slice(0, CLOUD_TTS_CHARS);
  const { synthesizeGeminiFemale } = await import(
    "@/lib/offlineVoice/geminiTts"
  );
  const direct = await synthesizeGeminiFemale(clip).catch(() => null);
  if (direct && direct.length > 80) return direct;

  const { api } = await import("@/services/api");
  const { store } = await import("@/store");
  const result = await Promise.race([
    store
      .dispatch(api.endpoints.speak.initiate({ textBn: clip }))
      .unwrap()
      .catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
  ]);
  const audio = result?.audioBase64;
  if (audio && audio.length > 80) return audio;
  cloudTtsBlockedUntil = Date.now() + CLOUD_TTS_COOLDOWN_MS;
  return null;
}

async function fetchCloudWav(text: string, gen: number, index: number) {
  const { File, Paths } = await import("expo-file-system");
  const audio = await fetchCloudAudio(text);
  if (!audio || gen !== speakGen) return null;
  const file = new File(Paths.cache, `aronno-voice-${gen}-${index}.wav`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytesFromBase64(audio));
  return file;
}

/** Online replies use Gemini's free female Bangla voice. Offline stays on the phone. */
async function speakWithCloudFemale(
  text: string,
  handlers?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  },
): Promise<boolean> {
  const { fetchIsOnline } = await import("@/hooks/useIsOnline");
  if (!(await fetchIsOnline())) return false;
  const chunks = cloudSpeechChunks(text);
  if (!chunks.length) return false;
  const gen = speakGen;
  let played = false;
  try {
    await enablePlaybackAudio();
    let upcoming = fetchCloudWav(chunks[0], gen, 0);
    for (let i = 0; i < chunks.length; i += 1) {
      if (gen !== speakGen) {
        handlers?.onStopped?.();
        return true;
      }
      let file = await upcoming;
      if (!file) file = await fetchCloudWav(chunks[i], gen, i);
      if (!file) {
        if (!played) return false;
        const rest = chunks.slice(i).join(" ");
        if (!(await speakWithLocalFemale(rest))) {
          await speakBangla(rest);
        }
        played = true;
        break;
      }
      if (i + 1 < chunks.length) upcoming = fetchCloudWav(chunks[i + 1], gen, i + 1);
      try {
        await playFile(file.uri, gen);
        played = true;
      } finally {
        if (file.exists) file.delete();
      }
    }
    if (!played) return false;
    if (gen !== speakGen) {
      handlers?.onStopped?.();
      return true;
    }
    await stopPlayingSound();
    handlers?.onDone?.();
    return true;
  } catch {
    return played;
  }
}

export type SpeechStream = {
  /** Add the next piece of the answer; audio for it starts preparing now. */
  push: (text: string) => void;
  /** Resolves when everything pushed so far has been spoken (or stopped). */
  done: () => Promise<void>;
  /** True once at least one piece was pushed. */
  started: () => boolean;
};

/**
 * Speak an answer while it is still being written. Each pushed piece starts
 * synthesising immediately (female Gemini voice online, Piper offline) while
 * earlier pieces play, so there is no gap waiting for the full reply.
 * `stopOfflineSpeech()` cancels everything queued.
 */
export function createSpeechStream(handlers?: {
  onFirstAudio?: () => void;
}): SpeechStream {
  const gen = speakGen;
  let synthChain: Promise<unknown> = Promise.resolve();
  let playChain: Promise<void> = Promise.resolve();
  let index = 0;
  let pushed = false;
  let announced = false;
  let cloudOk: boolean | null = null; // decided once, keeps one voice per answer
  let audioReady: Promise<unknown> | null = null;

  type Clip = { uri: string; cleanup?: () => void } | null;

  const synthesize = async (text: string, i: number): Promise<Clip> => {
    if (gen !== speakGen) return null;
    audioReady ??= enablePlaybackAudio().catch(() => undefined);
    await audioReady;
    if (cloudOk === null) {
      // On-device Piper starts in well under a second; the cloud voice needs a
      // network round trip per clip. Prefer Piper whenever it is installed.
      const piper =
        sherpaReady ||
        (!sherpaDisabled && (await hasOfflineTtsFiles().catch(() => false)));
      if (piper) {
        cloudOk = false;
      } else {
        const { fetchIsOnline } = await import("@/hooks/useIsOnline");
        cloudOk = await fetchIsOnline();
      }
    }
    if (cloudOk) {
      const file = await fetchCloudWav(text, gen, 1000 + i).catch(() => null);
      if (file) {
        return {
          uri: file.uri,
          cleanup: () => {
            if (file.exists) file.delete();
          },
        };
      }
      cloudOk = false; // cloud voice failed once → stay on Piper for this answer
    }
    if (!sherpaReady && !sherpaDisabled) await initTTS().catch(() => false);
    const TTS = sherpaReady ? await getTTS() : null;
    if (!TTS) return null;
    const uri = await synthesizeSherpa(TTS, text).catch(() => null);
    return uri ? { uri } : null;
  };

  const push = (text: string) => {
    const prepared = prepareSpeechText(text);
    if (!prepared || gen !== speakGen) return;
    pushed = true;
    // Piper clips stay short; long pieces split on sentence/comma boundaries.
    for (const piece of speechPlan(prepared)) {
      const i = index++;
      // Synthesis runs in order but ahead of playback.
      const clip = synthChain.then(() => synthesize(piece, i));
      synthChain = clip.catch(() => null);
      playChain = playChain.then(async () => {
        if (gen !== speakGen) return;
        const ready = await clip.catch(() => null);
        if (gen !== speakGen) {
          ready?.cleanup?.();
          return;
        }
        if (!announced) {
          announced = true;
          handlers?.onFirstAudio?.();
        }
        if (ready) {
          try {
            await playFile(ready.uri, gen);
          } catch {
            // skip a broken clip
          } finally {
            ready.cleanup?.();
          }
        } else {
          await speakBangla(piece).catch(() => undefined);
        }
      });
    }
  };

  return {
    push,
    done: async () => {
      await playChain.catch(() => undefined);
      if (gen === speakGen) await stopPlayingSound();
    },
    started: () => pushed,
  };
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
