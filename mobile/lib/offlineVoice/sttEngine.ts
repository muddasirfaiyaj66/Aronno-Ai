/**
 * Offline Bangla STT via @siteed/sherpa-onnx.rn.
 * Supports one-shot push-to-talk and silence-ended utterances for live chat.
 */
import { Audio } from "expo-av";
import type { AsrModelConfig } from "@siteed/sherpa-onnx.rn";
import { catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import { enablePlaybackAudio, enableRecordingAudio, SPEECH_RECORDING } from "@/lib/speechRecording";
import { logMetric, markStart } from "@/lib/offline/metrics";

type SherpaAsr = typeof import("@siteed/sherpa-onnx.rn").ASR;

/**
 * Loaded on first use: sherpa-onnx throws at import time when its native
 * module is missing (e.g. Expo Go), which would crash every screen that
 * imports this file.
 */
function loadAsr(): SherpaAsr {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@siteed/sherpa-onnx.rn") as { ASR: SherpaAsr }).ASR;
}

let ready = false;
let recording: Audio.Recording | null = null;

/** Speech must be this many dB above the measured room noise. */
const SPEECH_ABOVE_FLOOR_DB = 7;
/** Never treat anything quieter than this as speech. */
const MIN_SPEECH_DB = -58;
/** Below this for a whole turn, the mic is delivering nothing at all. */
const DEAD_MIC_DB = -72;
/** Time spent measuring room noise at the start of each turn. */
const CALIBRATE_MS = 400;
/** Silence after speech before ending the utterance. */
const SILENCE_MS = 1400;
/** Ignore tiny blips before treating as real speech. */
const MIN_SPEECH_MS = 220;
/** Give up waiting for the user to start talking. */
const NO_SPEECH_MS = 12000;
/** Hard cap so we never hang forever. */
const MAX_UTTERANCE_MS = 18000;

export type ListenResult = {
  text: string;
  /** True when the mic delivered no audible signal for the whole turn. */
  micSilent: boolean;
};

function nativePath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

export async function initSTT(): Promise<boolean> {
  const end = markStart("stt.init");
  const entry = catalogByKind("stt")[0];
  if (!entry || !(await isInstalled(entry))) {
    ready = false;
    end("model-not-downloaded");
    return false;
  }
  try {
    const config: AsrModelConfig = {
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
    };
    const result = await loadAsr().initialize(config);
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

export async function isSTTReady(): Promise<boolean> {
  if (ready) return true;
  return initSTT();
}

async function transcribeUri(uri: string): Promise<string> {
  const result = await loadAsr().recognizeFromFile(nativePath(uri));
  return (result.text ?? "").trim();
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
  const end = markStart("stt.recognize");
  try {
    await rec.stopAndUnloadAsync();
    if (recording === rec) recording = null;
    await enablePlaybackAudio();
    const uri = rec.getURI();
    if (!uri) {
      end("no-uri");
      return "";
    }
    const text = await transcribeUri(uri);
    end(text.slice(0, 40));
    return text;
  } catch (err) {
    end(err instanceof Error ? err.message : "fail");
    return "";
  }
}

/**
 * Record until the user has spoken and then stayed silent briefly
 * (Gemini-style turn end). Call `cancel()` to abort early.
 */
export function listenUntilSilence(handlers?: {
  onListening?: () => void;
  onSpeech?: () => void;
  /** Mic loudness 0..1, ~10×/second — drive a level meter with it. */
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
    if (!ready) {
      const ok = await initSTT();
      if (!ok) return empty;
    }
    if (!(await ensureMicPermission())) return empty;

    let rec: Audio.Recording;
    try {
      rec = await beginRecording();
      handlers?.onListening?.();
      logMetric("stt.live.start");
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
        // No metering on this device — fall back to a fixed-length turn.
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
        // Let the floor follow slow room-noise changes before speech starts.
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
    logMetric(
      "stt.live.levels",
      undefined,
      `max=${Math.round(maxDb)} floor=${Math.round(floor)} heard=${heardSpeech}`,
    );

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

/**
 * Push-to-talk: Record → offline STT. Emits "…" while recording; final on stop().
 */
export function startListening(
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
): () => void {
  let stopped = false;

  void (async () => {
    if (!ready) {
      const ok = await initSTT();
      if (!ok) {
        logMetric("stt.start", undefined, "not-ready");
        onFinal("");
        return;
      }
    }
    try {
      if (!(await ensureMicPermission())) {
        onFinal("");
        return;
      }
      await beginRecording();
      onPartial("…");
      logMetric("stt.start");
    } catch (err) {
      logMetric(
        "stt.start",
        undefined,
        err instanceof Error ? err.message : "fail",
      );
      onFinal("");
    }
  })();

  return () => {
    if (stopped) return;
    stopped = true;
    void (async () => {
      const rec = recording;
      recording = null;
      if (!rec) {
        onFinal("");
        return;
      }
      onFinal(await endRecordingAndTranscribe(rec));
    })();
  };
}

export async function transcribeOfflineFile(uri: string): Promise<string> {
  if (!ready) {
    const ok = await initSTT();
    if (!ok) throw new Error("stt-not-ready");
  }
  return transcribeUri(uri);
}
