/**
 * Bangla STT: prefer on-device sherpa when the Zipformer pack is installed;
 * fall back to cloud /diagnoses/transcribe when online.
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
  SPEECH_RECORDING,
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

const SPEECH_ABOVE_FLOOR_DB = 5;
const MIN_SPEECH_DB = -60;
const DEAD_MIC_DB = -72;
const CALIBRATE_MS = 450;
const SILENCE_MS = 1800;
const MIN_SPEECH_MS = 450;
const NO_SPEECH_MS = 14000;
const MAX_UTTERANCE_MS = 20000;

export type ListenResult = {
  text: string;
  micSilent: boolean;
};

function nativePath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

async function loadCrashGuard(): Promise<void> {
  try {
    const initing = await AsyncStorage.getItem(SHERPA_INITING);
    // Only treat a mid-init death as a hard disable (flag left behind).
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
    asrApi = mod.ASR as AsrApi;
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
    // Same config that worked before for Bangla Zipformer + recognizeFromFile.
    const result = await ASR.initialize({
      modelDir: nativePath(localDir(entry)),
      modelType: "transducer",
      streaming: true,
      numThreads: 2,
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

async function transcribeUri(uri: string): Promise<string> {
  const end = markStart("stt.recognize");
  try {
    if (ready) {
      const offline = await transcribeWithSherpa(uri);
      if (offline) {
        end(`offline:${offline.slice(0, 40)}`);
        return offline;
      }
    }
    const cloud = await transcribeWithCloud(uri);
    end(cloud ? `cloud:${cloud.slice(0, 40)}` : "empty");
    return cloud;
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
  const created = await Audio.Recording.createAsync(SPEECH_RECORDING);
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

async function prepareEngine(forceOffline = false): Promise<"offline" | "cloud" | "none"> {
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
  // Only force-clear crash guard when we have files but aren't warm yet.
  if (await hasOfflineSttFiles()) {
    return prepareEngine(true);
  }
  if (await fetchIsOnline()) return "cloud";
  return "none";
}

/**
 * Record until speech + silence, then offline or cloud STT.
 */
export function listenUntilSilence(handlers?: {
  onListening?: () => void;
  onSpeech?: () => void;
  onLevel?: (level: number) => void;
}): { cancel: () => void; done: Promise<ListenResult> } {
  let cancelled = false;
  let cancelResolve: (() => void) | null = null;
  const cancelWait = new Promise<void>((resolve) => {
    cancelResolve = resolve;
  });
  const empty: ListenResult = { text: "", micSilent: false };

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
      return empty;
    }
    if (!(await ensureMicPermission())) return empty;

    let rec: Audio.Recording;
    try {
      rec = await beginRecording();
      handlers?.onListening?.();
      logMetric("stt.live.start", undefined, mode);
    } catch {
      return empty;
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
        new Promise((r) => setTimeout(r, 100)),
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
        if (elapsed >= 5000) {
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
        floor = floor * 0.95 + db * 0.05;
      }

      const speechLongEnough =
        heardSpeech && now - speechStartedAt >= MIN_SPEECH_MS;
      const silentLongEnough = heardSpeech && now - lastLoudAt >= SILENCE_MS;
      if (speechLongEnough && silentLongEnough) break;
      if (!heardSpeech && elapsed >= NO_SPEECH_MS) break;
      if (elapsed >= MAX_UTTERANCE_MS) break;
    }

    handlers?.onLevel?.(0);

    if (cancelled) {
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

export function startListening(
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
): () => void {
  let stopped = false;
  let rec: Audio.Recording | null = null;

  void (async () => {
    const mode = await prepareEngine();
    if (mode === "none") {
      onFinal("");
      return;
    }
    try {
      if (!(await ensureMicPermission())) {
        onFinal("");
        return;
      }
      rec = await beginRecording();
      onPartial("…");
      await new Promise((r) => setTimeout(r, MAX_UTTERANCE_MS));
      if (stopped || !rec) {
        onFinal("");
        return;
      }
      const text = await endRecordingAndTranscribe(rec);
      rec = null;
      onFinal(text);
    } catch {
      onFinal("");
    }
  })();

  return () => {
    if (stopped) return;
    stopped = true;
    void (async () => {
      const active = rec ?? recording;
      recording = null;
      rec = null;
      if (!active) {
        onFinal("");
        return;
      }
      onFinal(await endRecordingAndTranscribe(active));
    })();
  };
}

export async function transcribeOfflineFile(uri: string): Promise<string> {
  await prepareEngine();
  return transcribeUri(uri);
}
