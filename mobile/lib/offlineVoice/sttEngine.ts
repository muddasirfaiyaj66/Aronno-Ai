/**
 * Offline Bangla STT via @siteed/sherpa-onnx.rn (streaming Zipformer transducer).
 * Mic: expo-av record → recognizeFromFile (reliable without a live PCM module).
 */
import { Audio } from "expo-av";
import { ASR } from "@siteed/sherpa-onnx.rn";
import type { AsrModelConfig } from "@siteed/sherpa-onnx.rn";
import { catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import { enablePlaybackAudio, SPEECH_RECORDING } from "@/lib/speechRecording";
import { logMetric, markStart } from "@/lib/offline/metrics";

let ready = false;
let recording: Audio.Recording | null = null;

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
    const result = await ASR.initialize(config);
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
  const result = await ASR.recognizeFromFile(nativePath(uri));
  return (result.text ?? "").trim();
}

/**
 * Record → offline STT. Emits "…" while recording; final text on stop().
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
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        onFinal("");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const created = await Audio.Recording.createAsync(SPEECH_RECORDING);
      recording = created.recording;
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
      const end = markStart("stt.recognize");
      try {
        await rec.stopAndUnloadAsync();
        await enablePlaybackAudio();
        const uri = rec.getURI();
        if (!uri) {
          end("no-uri");
          onFinal("");
          return;
        }
        const text = await transcribeUri(uri);
        end(text.slice(0, 40));
        onFinal(text);
      } catch (err) {
        end(err instanceof Error ? err.message : "fail");
        onFinal("");
      }
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
