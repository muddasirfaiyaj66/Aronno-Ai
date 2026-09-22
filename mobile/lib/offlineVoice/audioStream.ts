/**
 * Mic helpers for offline STT. Recording lifecycle lives in sttEngine.startListening;
 * this module exposes PCM-oriented hooks for a future live-stream path.
 */
export async function startAudioStream(
  _onPcm: (frame: Float32Array) => void,
): Promise<() => void> {
  // Live PCM requires an extra native audio-stream module.
  // Offline STT currently uses record → recognizeFromFile in sttEngine.
  return () => undefined;
}
