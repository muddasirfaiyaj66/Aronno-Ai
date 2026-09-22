/**
 * Mic PCM frames → streaming STT (sherpa-onnx).
 * Sprint 1: implement with expo-av / native audio callback.
 */
export async function startAudioStream(
  _onPcm: (frame: Float32Array) => void,
): Promise<() => void> {
  return () => {
    // stop
  };
}
