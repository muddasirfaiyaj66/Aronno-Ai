/**
 * Bangla STT: prefer on-device sherpa when the Zipformer pack is installed;
 * fall back to cloud /diagnoses/transcribe when online.
 *
 * Audio for offline ASR is always 16 kHz mono WAV — AAC/44.1k caused
 * character and word errors with Zipformer recognizeFromFile.
 *
 * Crash guard: if a previous ASR.initialize() killed the process, we skip
 * sherpa on the next launch and use cloud/text instead.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { fetchIsOnline } from "@/hooks/useIsOnline";
import { catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import { mimeFromAudioUri, readFileBase64 } from "@/lib/readFileBase64";
import {
  enablePlaybackAudio,
  enableRecordingAudio,
  STT_SPEECH_RECORDING,
} from "@/lib/speechRecording";
import { logMetric, markStart } from "@/lib/offline/metrics";
import { api } from "@/services/api";
import { store } from "@/store";

const SHERPA_INITING = "aronno.sherpa.stt.initing";
const SHERPA_BAD = "aronno.sherpa.stt.bad";

let ready = false;
let sherpaDisabled = false;
let recording: Audio.Recording | null = null;

type AsrApi = {
  initialize: (config: Record<string, unknown>) => Promise<{
    success: boolean;
    error?: string;
  }>;
  recognizeFromFile: (path: string) => Promise<{ text?: string }>;
};
let asrApi: AsrApi | null = null;

/** How much louder than ambient floor counts as speech. */
const SPEECH_ABOVE_FLOOR_DB = 5;
const MIN_SPEECH_DB = -55;
const DEAD_MIC_DB = -72;
const CALIBRATE_MS = 350;
/** Wait after last loud frame before ending (shorter = the reply starts sooner). */
const SILENCE_MS = 1200;
const MIN_SPEECH_MS = 400;
const NO_SPEECH_MS = 10000;
const MAX_UTTERANCE_MS = 24000;
const METER_POLL_MS = 90;

export type ListenResult = {
  text: string;
  micSilent: boolean;
  error?: "permission" | "no-engine" | "record";
};

function nativePath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

async function loadCrashGuard(): Promise<void> {
  try {
    const initing = await AsyncStorage.getItem(SHERPA_INITING);
    if (initing === "1") {
      sherpaDisabled = true;
      await AsyncStorage.multiSet([
        [SHERPA_INITING, ""],
        [SHERPA_BAD, "1"],
      ]).catch(() => undefined);
      await AsyncStorage.removeItem(SHERPA_INITING).catch(() => undefined);
      logMetric("stt.sherpa.disabled", undefined, "prior-crash");
    } else if ((await AsyncStorage.getItem(SHERPA_BAD)) === "1") {
      sherpaDisabled = true;
    }
  } catch {
    // ignore
  }
}

/** Clear bad/crash flags so offline STT can be tried again (user-initiated). */
export async function resetSherpaCrashGuard(): Promise<void> {
  sherpaDisabled = false;
  ready = false;
  asrApi = null;
  await AsyncStorage.multiRemove([SHERPA_INITING, SHERPA_BAD]).catch(
    () => undefined,
  );
}

async function getASR(): Promise<AsrApi | null> {
  if (sherpaDisabled) return null;
  if (asrApi) return asrApi;
  try {
    const mod = await import("@siteed/sherpa-onnx.rn");
    asrApi = mod.ASR as unknown as AsrApi;
    return asrApi;
  } catch {
    sherpaDisabled = true;
    return null;
  }
}

/** Offline Zipformer files present (does not load native). */
export async function hasOfflineSttFiles(): Promise<boolean> {
  const entry = catalogByKind("stt")[0];
  if (!entry) return false;
  return isInstalled(entry);
}

/**
 * Warm offline sherpa. Pass `{ force: true }` after user taps কণ্ঠ চালু
 * to clear a soft disable and retry the pack that used to work.
 */
export async function initSTT(opts?: { force?: boolean }): Promise<boolean> {
  const end = markStart("stt.init");
  if (opts?.force) await resetSherpaCrashGuard();
  else await loadCrashGuard();

  if (ready) {
    end("already");
    return true;
  }
  if (sherpaDisabled) {
    end("disabled");
    return false;
  }
  const entry = catalogByKind("stt")[0];
  if (!entry || !(await isInstalled(entry))) {
    end("model-not-downloaded");
    return false;
  }

  try {
    await AsyncStorage.setItem(SHERPA_INITING, "1");
    const ASR = await getASR();
    if (!ASR) {
      await AsyncStorage.removeItem(SHERPA_INITING).catch(() => undefined);
      end("no-native");
      return false;
    }
    // Streaming Zipformer (bn-vosk) — must use streaming:true. Offline init
    // rejects and used to abort before any retry, which broke all voice.
    const result = await ASR.initialize({
      modelDir: nativePath(localDir(entry)),
      modelType: "transducer",
      streaming: true,
      numThreads: 2,
      sampleRate: 16000,
      featureDim: 80,
      decodingMethod: "greedy_search",
      modelFiles: {
        encoder: "encoder.onnx",
        decoder: "decoder.onnx",
        joiner: "joiner.onnx",
        tokens: "tokens.txt",
      },
    });
    await AsyncStorage.removeItem(SHERPA_INITING).catch(() => undefined);
    if (!result.success) {
      end(result.error ?? "init-failed");
      return false;
    }
    ready = true;
    end("ok");
    return true;
  } catch (err) {
    await AsyncStorage.removeItem(SHERPA_INITING).catch(() => undefined);
    end(err instanceof Error ? err.message : "init-failed");
    return false;
  }
}

/** Ready for voice: offline model warm OR online cloud STT. */
export async function isSTTReady(): Promise<boolean> {
  if (ready) return true;
  if (await hasOfflineSttFiles()) return true;
  return fetchIsOnline();
}

export async function hasSttModel(): Promise<boolean> {
  return hasOfflineSttFiles();
}

async function transcribeWithSherpa(uri: string): Promise<string> {
  const ASR = await getASR();
  if (!ASR || !ready) return "";
  const result = await ASR.recognizeFromFile(nativePath(uri));
  return (result.text ?? "").trim();
}

async function transcribeWithCloud(uri: string): Promise<string> {
  if (!(await fetchIsOnline())) return "";
  const audioBase64 = await readFileBase64(uri);
  if (audioBase64.length < 80) return "";
  const result = await store
    .dispatch(
      api.endpoints.transcribe.initiate({
        audioBase64,
        mimeType: mimeFromAudioUri(uri),
      }),
    )
    .unwrap();
  return (result.transcriptBn ?? "").trim();
}

/**
 * Robust Bangla STT post-processing for offline voice.
 * Cleans model artifacts, normalises phonetics, and removes stutter/filler
 * to ensure accurate downstream NLU and model responses.
 */
export function cleanSttTranscript(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  // Strip model tags / bracket noise / HTML
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\[[^\]]*\]/g, "");
  s = s.replace(/\([^)]{0,12}(?:noise|music|laughter|silence|breath|cough)[^)]*\)/gi, "");

  // Zero-width spaces, joiners, and BOM marks that break Bangla matching
  s = s.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "");

  // Collapse vowel sign stutters (in Bangla a vowel mark cannot repeat on a letter)
  s = s.replace(/([\u09BE-\u09CC\u09D7\u09BC])\1+/gu, "$1");

  // Collapse runaway character stutter (e.g. কককক -> কক, aaaa -> aa)
  s = s.replace(/([\u0980-\u09FF\w])\1{2,}/gu, "$1$1");

  // Syllable stutter in Bengali (2-3 char sequences repeated 3+ times)
  s = s.replace(/([\u0980-\u09FF]{2,3})\1{2,}/gu, "$1");

  // Common spoken filler prefixes that confuse the LLM
  s = s.replace(/^(?:ওই\s+যে|মানে\s+|বলছিলাম\s+যে|আরে\s+|শুনুন\s+)+/i, "");

  // Common Bengali ASR phonetic misrecognitions in agriculture
  s = s.replace(/টোমেটো/g, "টমেটো");
  s = s.replace(/পোটেটো/g, "আলু");
  s = s.replace(/\bধান\s*এ\b/g, "ধানে");
  s = s.replace(/\bধান\s*এর\b/g, "ধানের");
  s = s.replace(/\bআলু\s*র\b/g, "আলুর");
  s = s.replace(/\bআলু\s*তে\b/g, "আলুতে");
  s = s.replace(/\bটমেটো\s*র\b/g, "টমেটোর");
  s = s.replace(/\bটমেটো\s*তে\b/g, "টমেটোতে");
  s = s.replace(/\bমরিচ\s*এর\b/g, "মরিচের");
  s = s.replace(/\bমরিচ\s*এ\b/g, "মরিচে");
  s = s.replace(/\bকীট\s+নাশক\b/g, "কীটনাশক");
  s = s.replace(/\bছত্রাক\s+নাশক\b/g, "ছত্রাকনাশক");
  s = s.replace(/\bপোকা\s+মাকড়\b/g, "পোকামাকড়");
  s = s.replace(/\bইউরিয়া\b/g, "ইউরিয়া");
  s = s.replace(/\bপটাস\b/g, "পটাশ");
  s = s.replace(/\bটেম্পারেচার\b|\bটেম্পরেচার\b/g, "তাপমাত্রা");
  s = s.replace(/\bআবহাওয়া\b/g, "আবহাওয়া");

  // Normalize punctuation and whitespace
  s = s.replace(/\s*([।!?.,;:])\s*/g, "$1 ");
  s = s.replace(/([।!?]){2,}/g, "$1");
  s = s.replace(/\s+/g, " ").trim();

  // Drop single isolated characters or noise filler words.
  // Keep short real replies such as «হ্যাঁ», «না», and «hello».
  if (/^(?:[a-zA-Z]|[\u0980-\u09FF]|[।!?.,;:\-\s])+$/.test(s) && s.length <= 1) {
    return "";
  }
  if (/^(?:আহ|উম|উঁ|হুম|এই|ওই)[।.!?\s]*$/i.test(s)) {
    return "";
  }

  return s;
}

/** Cloud STT gives up after this, so offline sherpa can still answer. */
const CLOUD_STT_TIMEOUT_MS = 15_000;

function cloudWithTimeout(uri: string): Promise<string> {
  return Promise.race([
    transcribeWithCloud(uri).catch(() => ""),
    new Promise<string>((r) => setTimeout(() => r(""), CLOUD_STT_TIMEOUT_MS)),
  ]);
}

/**
 * Online: Gemini (via backend) first — it understands everyday Bangla far
 * better than the small on-device model, which often returns a stray letter
 * or two. Offline, or when the cloud gives nothing: sherpa.
 */
async function transcribeUri(uri: string): Promise<string> {
  const end = markStart("stt.recognize");
  try {
    const online = await fetchIsOnline().catch(() => false);
    if (online) {
      const cloud = cleanSttTranscript(await cloudWithTimeout(uri));
      if (cloud.length >= 2) {
        end(`cloud:${cloud.slice(0, 40)}`);
        return cloud;
      }
    }
    if (ready) {
      const offline = cleanSttTranscript(await transcribeWithSherpa(uri));
      if (offline.length >= 2) {
        end(`offline:${offline.slice(0, 40)}`);
        return offline;
      }
    }
    end("empty");
    return "";
  } catch (err) {
    end(err instanceof Error ? err.message : "fail");
    return "";
  }
}

async function ensureMicPermission(): Promise<boolean> {
  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
}

async function beginRecording(): Promise<Audio.Recording> {
  await enableRecordingAudio();
  const created = await Audio.Recording.createAsync(STT_SPEECH_RECORDING);
  recording = created.recording;
  return created.recording;
}

async function endRecordingAndTranscribe(
  rec: Audio.Recording,
): Promise<string> {
  try {
    await rec.stopAndUnloadAsync();
    if (recording === rec) recording = null;
    await enablePlaybackAudio();
    const uri = rec.getURI();
    if (!uri) return "";
    return transcribeUri(uri);
  } catch {
    return "";
  }
}

async function prepareEngine(
  forceOffline = false,
): Promise<"offline" | "cloud" | "none"> {
  if (forceOffline) {
    await resetSherpaCrashGuard();
  } else {
    await loadCrashGuard();
  }
  if (ready) return "offline";
  if (await hasOfflineSttFiles()) {
    const ok = await initSTT(forceOffline ? { force: true } : undefined);
    if (ok) return "offline";
  }
  if (await fetchIsOnline()) return "cloud";
  return "none";
}

/** Call once when user confirms কণ্ঠ চালু — restores offline STT if files exist. */
export async function warmSttForLive(): Promise<"offline" | "cloud" | "none"> {
  if (ready) return "offline";
  if (await hasOfflineSttFiles()) {
    return prepareEngine(true);
  }
  if (await fetchIsOnline()) return "cloud";
  return "none";
}

/**
 * Record until speech + trailing silence, then offline or cloud STT.
 * If `cancel()` is called after speech started, still decode the clip
 * (push-to-talk stop). Pass `{ discardOnCancel: true }` to drop audio.
 */
export function listenUntilSilence(handlers?: {
  onListening?: () => void;
  onSpeech?: () => void;
  onLevel?: (level: number) => void;
  discardOnCancel?: boolean;
}): { cancel: () => void; done: Promise<ListenResult> } {
  let cancelled = false;
  let cancelResolve: (() => void) | null = null;
  const cancelWait = new Promise<void>((resolve) => {
    cancelResolve = resolve;
  });
  const empty: ListenResult = { text: "", micSilent: false };
  const discardOnCancel = handlers?.discardOnCancel === true;

  const discard = async (rec: Audio.Recording) => {
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      // ignore
    }
    if (recording === rec) recording = null;
    await enablePlaybackAudio().catch(() => undefined);
  };

  const done = (async (): Promise<ListenResult> => {
    const mode = await prepareEngine();
    if (mode === "none") {
      logMetric("stt.live.start", undefined, "no-engine");
      return { ...empty, error: "no-engine" };
    }
    if (!(await ensureMicPermission())) {
      return { ...empty, error: "permission" };
    }

    let rec: Audio.Recording;
    try {
      rec = await beginRecording();
      handlers?.onListening?.();
      logMetric("stt.live.start", undefined, mode);
    } catch {
      return { ...empty, error: "record" };
    }

    const startedAt = Date.now();
    const calibration: number[] = [];
    let floor = -60;
    let heardSpeech = false;
    let speechStartedAt = 0;
    let lastLoudAt = 0;
    let sawMetering = false;
    let maxDb = -160;

    while (!cancelled) {
      await Promise.race([
        new Promise((r) => setTimeout(r, METER_POLL_MS)),
        cancelWait,
      ]);
      if (cancelled) break;

      let db = -160;
      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording && typeof status.metering === "number") {
          sawMetering = true;
          db = status.metering;
        }
      } catch {
        // keep polling
      }

      const now = Date.now();
      const elapsed = now - startedAt;
      maxDb = Math.max(maxDb, db);
      handlers?.onLevel?.(Math.min(1, Math.max(0, (db + 60) / 50)));

      if (!sawMetering) {
        if (elapsed >= 6000) {
          heardSpeech = true;
          break;
        }
        continue;
      }

      if (elapsed < CALIBRATE_MS) {
        calibration.push(db);
        continue;
      }
      if (calibration.length) {
        floor = calibration.reduce((a, b) => a + b, 0) / calibration.length;
        calibration.length = 0;
      }

      const threshold = Math.max(MIN_SPEECH_DB, floor + SPEECH_ABOVE_FLOOR_DB);
      if (db > threshold) {
        if (!heardSpeech) {
          heardSpeech = true;
          speechStartedAt = now;
          handlers?.onSpeech?.();
        }
        lastLoudAt = now;
      } else if (!heardSpeech) {
        floor = floor * 0.92 + db * 0.08;
      }

      const speechLongEnough =
        heardSpeech && now - speechStartedAt >= MIN_SPEECH_MS;
      const silentLongEnough = heardSpeech && now - lastLoudAt >= SILENCE_MS;
      if (speechLongEnough && silentLongEnough) break;
      if (!heardSpeech && elapsed >= NO_SPEECH_MS) break;
      if (elapsed >= MAX_UTTERANCE_MS) break;
    }

    handlers?.onLevel?.(0);

    if (cancelled && discardOnCancel) {
      await discard(rec);
      return empty;
    }

    // Toggle-stop: always try to decode if we recorded long enough, even when
    // metering never crossed the speech threshold (quiet mics / soft speech).
    if (cancelled && !heardSpeech) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 700) {
        return {
          text: await endRecordingAndTranscribe(rec),
          micSilent: sawMetering && maxDb < DEAD_MIC_DB,
        };
      }
      await discard(rec);
      return empty;
    }

    if (!heardSpeech) {
      await discard(rec);
      return { text: "", micSilent: sawMetering && maxDb < DEAD_MIC_DB };
    }

    return { text: await endRecordingAndTranscribe(rec), micSilent: false };
  })();

  return {
    cancel: () => {
      cancelled = true;
      cancelResolve?.();
    },
    done,
  };
}

/**
 * Toggle listen: records until stop() — always transcribes the clip.
 * Also auto-ends after trailing silence for hands-free turns.
 */
export function startListening(
  onPartial: (text: string) => void,
  onFinal: (text: string, error?: ListenResult["error"]) => void,
): () => void {
  let finished = false;
  const finish = (text: string, error?: ListenResult["error"]) => {
    if (finished) return;
    finished = true;
    onFinal(text, error);
  };

  const session = listenUntilSilence({
    onListening: () => onPartial("…"),
    onSpeech: () => onPartial("শুনছি…"),
    discardOnCancel: false,
  });

  void session.done.then((result) => {
    finish(result.text, result.error);
  });

  return () => {
    session.cancel();
  };
}

export async function transcribeOfflineFile(uri: string): Promise<string> {
  await prepareEngine();
  return transcribeUri(uri);
}
