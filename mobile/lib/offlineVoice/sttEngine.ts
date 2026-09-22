/**
 * Offline Bangla STT via sherpa-onnx (native module).
 * Sprint 1: wire NativeModules.SherpaSTT; until then this is a typed stub.
 */
export type SttCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
};

export async function initSTT(_paths?: {
  encoder: string;
  decoder: string;
  joiner: string;
  tokens: string;
}): Promise<void> {
  // TODO(Sprint 1): SherpaSTT.init(...)
}

export function startListening(
  _onPartial: (text: string) => void,
  _onFinal: (text: string) => void,
): () => void {
  // TODO(Sprint 1): start streaming + event subscriptions
  return () => {
    // stopStreaming
  };
}

export async function isSTTReady(): Promise<boolean> {
  return false;
}
