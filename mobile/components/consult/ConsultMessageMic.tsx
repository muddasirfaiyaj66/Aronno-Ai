import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { fetchIsOnline } from "@/hooks/useIsOnline";
import { cleanSttTranscript } from "@/lib/offlineVoice/sttEngine";
import { mimeFromAudioUri, readFileBase64 } from "@/lib/readFileBase64";
import {
  enablePlaybackAudio,
  enableRecordingAudio,
  SPEECH_RECORDING,
} from "@/lib/speechRecording";
import { userFacingError } from "@/lib/userFacingError";
import { useTranscribeMutation } from "@/services/api";

const MIN_RECORD_MS = 900;

export type ConsultMicNotice = {
  kind: "recording" | "transcribing" | "error";
  text: string;
};

type Props = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onNotice: (notice: ConsultMicNotice | null) => void;
};

/**
 * Push-to-talk for the consult message.
 * Records with expo-av (already in the dev client; expo-audio is not) and
 * sends the clip to /diagnoses/transcribe. That Gemini path writes Bangla
 * speech as Bangla and English speech as English. The offline Zipformer
 * pack is Bangla-only, so this control does not use it.
 */
export function ConsultMessageMic({ disabled, onTranscript, onNotice }: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribing">("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startedAtRef = useRef(0);
  const alive = useRef(true);
  const lock = useRef(false);
  const stopping = useRef(false);
  const [transcribe] = useTranscribeMutation();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const rec = recordingRef.current;
      recordingRef.current = null;
      void rec?.stopAndUnloadAsync().catch(() => undefined);
      void enablePlaybackAudio().catch(() => undefined);
    };
  }, []);

  function fail(text: string) {
    stopping.current = false;
    lock.current = false;
    if (!alive.current) return;
    setPhase("idle");
    onNotice({ kind: "error", text });
  }

  async function start() {
    if (lock.current || disabled) return;
    lock.current = true;
    onNotice(null);
    if (!(await fetchIsOnline())) {
      fail("কথা লিখতে ইন্টারনেট লাগবে। এখন লিখে দিন।");
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!alive.current) {
        lock.current = false;
        return;
      }
      if (!permission.granted) {
        fail("মাইকের অনুমতি দিন, তারপর আবার চাপুন।");
        if (!permission.canAskAgain) void Linking.openSettings();
        return;
      }
      await enableRecordingAudio();
      const { recording } = await Audio.Recording.createAsync(SPEECH_RECORDING);
      if (!alive.current) {
        await recording.stopAndUnloadAsync().catch(() => undefined);
        await enablePlaybackAudio().catch(() => undefined);
        lock.current = false;
        return;
      }
      recordingRef.current = recording;
      startedAtRef.current = Date.now();
      setPhase("recording");
      onNotice({ kind: "recording", text: "শুনছি… বাংলা বা ইংরেজি বলুন" });
    } catch {
      await enablePlaybackAudio().catch(() => undefined);
      fail("মাইক চালু করা যায়নি। ফোনের সেটিংস দেখুন।");
    }
  }

  async function stopAndTranscribe() {
    if (stopping.current) return;
    stopping.current = true;
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (alive.current) {
      setPhase("transcribing");
      onNotice({ kind: "transcribing", text: "কথা লেখা হচ্ছে…" });
    }
    if (!rec) {
      stopping.current = false;
      lock.current = false;
      if (alive.current) {
        setPhase("idle");
        onNotice(null);
      }
      return;
    }
    try {
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed < MIN_RECORD_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_RECORD_MS - elapsed));
      }
      await rec.stopAndUnloadAsync();
      await enablePlaybackAudio();
      const uri = rec.getURI();
      if (!uri) {
        fail("রেকর্ডিং পাওয়া যায়নি। আবার বলুন।");
        return;
      }
      const audioBase64 = await readFileBase64(uri);
      if (audioBase64.length < 80) {
        fail("খুব ছোট রেকর্ডিং। একটু লম্বা করে বলুন।");
        return;
      }
      const { transcriptBn } = await transcribe({
        audioBase64,
        mimeType: mimeFromAudioUri(uri),
      }).unwrap();
      const cleaned = cleanSttTranscript(transcriptBn).trim();
      if (!alive.current) return;
      if (!cleaned) {
        fail("কথা বোঝা যায়নি। আবার বলুন, অথবা লিখুন।");
        return;
      }
      onTranscript(cleaned);
      stopping.current = false;
      lock.current = false;
      setPhase("idle");
      onNotice(null);
    } catch (err) {
      stopping.current = false;
      fail(userFacingError(err, "generic", "কথা লেখা যায়নি। এখানে লিখে দিন।"));
    }
  }

  function onPress() {
    if (disabled || phase === "transcribing") return;
    if (phase === "recording") {
      void stopAndTranscribe();
      return;
    }
    void start();
  }

  const recording = phase === "recording";
  const busy = phase === "transcribing";
  const label = recording ? "থামান" : busy ? "লেখা হচ্ছে" : "বলুন";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={recording ? "রেকর্ডিং থামান" : busy ? "কথা লেখা হচ্ছে" : "কথা বলুন"}
      accessibilityState={{ busy, disabled: !!disabled || busy }}
      hitSlop={6}
      className="min-h-touch flex-row items-center gap-1.5 rounded-full px-3.5"
      style={{
        opacity: disabled ? 0.55 : 1,
        backgroundColor: recording ? colors.forest900 : colors.secondary,
      }}
    >
      {busy ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Ionicons
          name={recording ? "stop" : "mic"}
          size={18}
          color={recording ? colors.white : colors.primary}
        />
      )}
      <AppText
        variant="caption"
        className={`font-bengali-semibold ${recording ? "text-white" : "text-primary"}`}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
