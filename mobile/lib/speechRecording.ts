import { Audio } from "expo-av";

/**
 * Mic capture for Bangla STT + cloud upload.
 * Use 16 kHz mono AAC — expo-av is reliable with M4A on Android, and
 * sherpa-onnx MediaExtractor decodes AAC then resamples to 16 kHz.
 * (Raw WAV via AndroidOutputFormat.DEFAULT often fails to create/record.)
 */
export const SPEECH_RECORDING: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 96000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 96000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 96000,
  },
};

/** Same as SPEECH_RECORDING — kept as an alias for STT call sites. */
export const STT_SPEECH_RECORDING = SPEECH_RECORDING;

export async function enablePlaybackAudio() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: false,
  });
}

/** Call before mic listen so recording + playback don't fight. */
export async function enableRecordingAudio() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
  });
}
