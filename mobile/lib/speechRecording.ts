import { Audio } from "expo-av";

/** Mono AAC — small enough for Vercel, clear enough for Bangla STT. */
export const SPEECH_RECORDING: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 48000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 48000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 48000,
  },
};

export async function enablePlaybackAudio() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    // Speaker, not earpiece — clearer assistant voice.
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
