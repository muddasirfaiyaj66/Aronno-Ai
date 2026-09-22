/**
 * Offline Bangla STT via sherpa-onnx native module (optional).
 * Until the native bridge + Zipformer model are installed, isSTTReady() is false
 * and callers should fall back to typing or cloud STT when online.
 */
import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import { catalogByKind } from "@/lib/modelManager/catalog";
import { isInstalled, localDir } from "@/lib/modelManager/modelManager";
import { logMetric, markStart } from "@/lib/offline/metrics";

type SherpaSTTModule = {
  init: (paths: {
    encoder: string;
    decoder: string;
    joiner: string;
    tokens: string;
  }) => Promise<void>;
  startStreaming: () => void;
  stopStreaming: () => void;
  addListener?: never;
};

const SherpaSTT = NativeModules.SherpaSTT as SherpaSTTModule | undefined;
let ready = false;
let emitter: NativeEventEmitter | null = null;

export async function initSTT(): Promise<boolean> {
  const end = markStart("stt.init");
  const entry = catalogByKind("stt")[0];
  if (!entry || !(await isInstalled(entry))) {
    ready = false;
    end("model-not-downloaded");
    return false;
  }
  if (!SherpaSTT) {
    ready = false;
    end("native-module-missing");
    return false;
  }
  try {
    const base = localDir(entry);
    await SherpaSTT.init({
      encoder: `${base}encoder.onnx`,
      decoder: `${base}decoder.onnx`,
      joiner: `${base}joiner.onnx`,
      tokens: `${base}tokens.txt`,
    });
    if (Platform.OS !== "web") {
      emitter = new NativeEventEmitter(NativeModules.SherpaSTT);
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

export function startListening(
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
): () => void {
  if (!ready || !SherpaSTT) {
    logMetric("stt.start", undefined, "not-ready");
    return () => undefined;
  }
  logMetric("stt.start");
  SherpaSTT.startStreaming();
  const subPartial = emitter?.addListener(
    "partialResult",
    (e: { text: string }) => onPartial(e.text),
  );
  const subFinal = emitter?.addListener(
    "finalResult",
    (e: { text: string }) => {
      logMetric("stt.final", undefined, e.text.slice(0, 40));
      onFinal(e.text);
    },
  );
  return () => {
    subPartial?.remove();
    subFinal?.remove();
    SherpaSTT?.stopStreaming();
  };
}
