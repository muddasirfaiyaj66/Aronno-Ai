import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppText,
  PrimaryButton,
  ScreenHeader,
  VoiceInputWidget,
} from "@/components/ui";
import { useLocale } from "@/context/locale";
import { useIsOnline } from "@/hooks/useIsOnline";
import { mimeFromAudioUri, readFileBase64 } from "@/lib/readFileBase64";
import { enablePlaybackAudio, SPEECH_RECORDING } from "@/lib/speechRecording";
import { getApiError, useTranscribeMutation } from "@/services/api";
import { isSTTReady, startListening } from "@/lib/offlineVoice/sttEngine";
import { logMetric } from "@/lib/offline/metrics";

const FLOW_CONTENT: Record<string, { subtitle: string }> = {
  disease: {
    subtitle: "ফসলের সমস্যাটি বাংলায় বলুন, অথবা নিচে লিখুন",
  },
  tool: {
    subtitle: "আপনার কাজটি বাংলায় বলুন, অথবা নিচে লিখুন",
  },
};

type Mode = "voice" | "text";

export default function VoiceCaptureScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const online = useIsOnline();
  const { flow, mode: modeParam } = useLocalSearchParams<{
    flow?: string;
    mode?: string;
  }>();
  const content = FLOW_CONTENT[flow ?? "disease"] ?? FLOW_CONTENT.disease;
  const [mode, setMode] = useState<Mode>(modeParam === "text" ? "text" : "voice");
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offlineStt, setOfflineStt] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const stopOfflineRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  const [transcribe] = useTranscribeMutation();

  useEffect(() => {
    void isSTTReady().then(setOfflineStt);
  }, []);

  useEffect(() => {
    if (!online && !offlineStt && mode === "voice") {
      setMode("text");
      setError(
        "অফলাইনে কণ্ঠ মডেল নেই — লিখে জানান, অথবা মডেল ম্যানেজার থেকে বাংলা STT ডাউনলোড করুন।",
      );
    }
  }, [online, offlineStt, mode]);

  useEffect(() => {
    return () => {
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      stopOfflineRef.current?.();
    };
  }, []);

  const handleToggleRecording = async () => {
    setError(null);

    // Offline streaming STT when sherpa model + native bridge are ready
    if (!online && offlineStt) {
      if (isRecording) {
        stopOfflineRef.current?.();
        stopOfflineRef.current = null;
        setIsRecording(false);
        return;
      }
      setIsRecording(true);
      logMetric("voice.offline.stt");
      stopOfflineRef.current = startListening(
        (partial) => setTranscript(partial),
        (finalText) => {
          setTranscript(finalText.trim());
          setIsRecording(false);
          stopOfflineRef.current = null;
        },
      );
      return;
    }

    if (isRecording) {
      const rec = recordingRef.current;
      recordingRef.current = null;
      setIsRecording(false);
      if (!rec) return;
      try {
        const elapsed = Date.now() - startedAtRef.current;
        if (elapsed < 900) {
          await new Promise((r) => setTimeout(r, 900 - elapsed));
        }
        await rec.stopAndUnloadAsync();
        await enablePlaybackAudio();
        const uri = rec.getURI();
        if (!uri) {
          setError("রেকর্ডিং পাওয়া যায়নি। আবার বলুন।");
          return;
        }
        setTranscribing(true);
        const audioBase64 = await readFileBase64(uri);
        if (audioBase64.length < 80) {
          setError("খুব ছোট রেকর্ডিং। একটু লম্বা করে বলুন।");
          return;
        }
        const { transcriptBn } = await transcribe({
          audioBase64,
          mimeType: mimeFromAudioUri(uri),
        }).unwrap();
        if (!transcriptBn.trim()) {
          setMode("text");
          setError("কথা পরিষ্কার শোনা যায়নি। এখানে লিখে দিন।");
        } else {
          setTranscript(transcriptBn.trim());
        }
      } catch (err) {
        setMode("text");
        setError(getApiError(err).message ?? "কথা লেখা যায়নি। এখানে লিখে দিন।");
      } finally {
        setTranscribing(false);
      }
      return;
    }

    if (!online) {
      setMode("text");
      setError(
        "অফলাইনে ক্লাউড STT কাজ করে না। লিখে জানান অথবা STT মডেল ডাউনলোড করুন।",
      );
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError("মাইকের অনুমতি দিন, তারপর আবার চাপুন।");
        if (!permission.canAskAgain) {
          void Linking.openSettings();
        }
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { recording } = await Audio.Recording.createAsync(SPEECH_RECORDING);
      recordingRef.current = recording;
      startedAtRef.current = Date.now();
      setIsRecording(true);
    } catch {
      setError("মাইক চালু করা যায়নি। ফোনের সেটিংস দেখুন।");
    }
  };

  const handleSubmit = () => {
    if (!transcript.trim()) return;
    router.push({
      pathname: "/(root)/(tabs)/scan/analyzing",
      params: { transcript: transcript.trim(), source: "voice", flow },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title={mode === "text" ? t("লিখে জানান", "Type it") : t("বাংলায় বলুন", "Speak Bangla")}
        subtitle={content.subtitle}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 py-5"
        keyboardShouldPersistTaps="handled"
      >
        {!online ? (
          <AppText variant="caption" className="rounded-xl bg-harvestSoft px-3 py-2 text-center">
            অফলাইন মোড
            {offlineStt
              ? " — ফোনের বাংলা STT ব্যবহার হবে"
              : " — টাইপ করুন অথবা মডেল ডাউনলোড করুন"}
          </AppText>
        ) : null}

        <View className="flex-row rounded-2xl bg-white p-1">
          {(
            [
              { id: "voice" as const, label: t("বলুন", "Speak") },
              { id: "text" as const, label: t("লিখুন", "Type") },
            ]
          ).map((item) => {
            const active = mode === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setMode(item.id);
                  if (item.id === "text") setIsRecording(false);
                }}
                className={`min-h-touch flex-1 items-center justify-center rounded-xl ${
                  active ? "bg-primary" : ""
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppText
                  variant="bodyLg"
                  className={`font-bengali-bold ${active ? "text-white" : "text-muted"}`}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <VoiceInputWidget
          isRecording={isRecording}
          transcript={transcript}
          onToggleRecording={() => {
            void handleToggleRecording();
          }}
          onChangeTranscript={setTranscript}
          preferTyping={mode === "text"}
          listeningLabel={
            transcribing
              ? t("কথা লেখা হচ্ছে…", "Writing your words…")
              : t("শুনছি… কথা বলুন", "Listening… speak now")
          }
          placeholder={
            mode === "text"
              ? t("এখানে বাংলায় লিখুন…", "Type in Bangla…")
              : t("মাইকে চাপুন, কথা বলুন, আবার চাপুন", "Tap mic, speak, tap again")
          }
        />

        {error ? (
          <AppText variant="caption" className="text-center text-severity-high">
            {error}
          </AppText>
        ) : (
          <AppText variant="caption" className="text-center leading-6">
            {t(
              "মাইকে চাপুন, বাংলায় বলুন, আবার চাপুন। জমা দেওয়ার আগে লেখা পড়ে নিন।",
              "Tap the mic, speak Bangla, tap again. Read the text before sending.",
            )}
          </AppText>
        )}

        <PrimaryButton
          label={transcribing ? t("লেখা হচ্ছে…", "Writing…") : t("জমা দিন", "Submit")}
          onPress={handleSubmit}
          disabled={!transcript.trim() || transcribing || isRecording}
          loading={transcribing}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
