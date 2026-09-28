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
import { enablePlaybackAudio, SPEECH_RECORDING, STT_SPEECH_RECORDING } from "@/lib/speechRecording";
import { userFacingError } from "@/lib/userFacingError";
import { useTranscribeMutation } from "@/services/api";
import {
  cleanSttTranscript,
  hasOfflineSttFiles,
  startListening,
  warmSttForLive,
} from "@/lib/offlineVoice/sttEngine";
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
  const modeRef = useRef<Mode>(modeParam === "text" ? "text" : "voice");
  const chooseMode = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offlineStt, setOfflineStt] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const stopOfflineRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  const [transcribe] = useTranscribeMutation();

  useEffect(() => {
    // Do not initialise Sherpa here.  It is a native module and must be warmed
    // only after the farmer deliberately starts recording.  Checking files is
    // safe and keeps the voice tab usable without a network connection.
    let active = true;
    void hasOfflineSttFiles()
      .then((available) => {
        if (active) setOfflineStt(available);
      })
      .catch(() => {
        if (active) setOfflineStt(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      stopOfflineRef.current?.();
    };
  }, []);

  const handleToggleRecording = async () => {
    setError(null);

    // The downloaded Zipformer pack is the primary offline path. Warm it
    // before opening the recorder so a missing/corrupt pack gives a clear
    // message instead of a blank transcript.
    if (!online && offlineStt) {
      if (isRecording) {
        stopOfflineRef.current?.();
        stopOfflineRef.current = null;
        setIsRecording(false);
        return;
      }
      setPreparing(true);
      const engine = await warmSttForLive();
      setPreparing(false);
      if (modeRef.current !== "voice") return;
      if (engine === "none") {
        chooseMode("text");
        setError(
          "বাংলা কণ্ঠ মডেল চালু হয়নি। মডেল ম্যানেজার থেকে আবার ডাউনলোড করুন, অথবা লিখে জানান।",
        );
        return;
      }
      setIsRecording(true);
      logMetric("voice.offline.stt");
      stopOfflineRef.current = startListening(
        (partial) => setTranscript(partial),
        (finalText, sttError) => {
          setIsRecording(false);
          stopOfflineRef.current = null;
          if (sttError === "permission") {
            setError("মাইকের অনুমতি দিন, তারপর আবার চাপুন।");
            return;
          }
          if (sttError === "record" || sttError === "no-engine") {
            chooseMode("text");
            setError("মাইক চালু করা যায়নি। এখানে লিখে জানান।");
            return;
          }
          const cleaned = cleanSttTranscript(finalText).trim();
          setTranscript(cleaned);
          if (!cleaned) {
            setError("কথা বোঝা যায়নি। আরেকটু স্পষ্ট করে বলুন, অথবা লিখে জানান।");
          }
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
        const cleaned = cleanSttTranscript(transcriptBn).trim();
        if (!cleaned) {
          chooseMode("text");
          setError("কথা পরিষ্কার শোনা যায়নি। এখানে লিখে দিন।");
        } else {
          setTranscript(cleaned);
        }
      } catch (err) {
        chooseMode("text");
        setError(userFacingError(err, "generic", "কথা লেখা যায়নি। এখানে লিখে দিন।"));
      } finally {
        setTranscribing(false);
      }
      return;
    }

    if (!online) {
      chooseMode("text");
      setError(
        "অফলাইনে বাংলা কণ্ঠ মডেল নেই। মডেল ম্যানেজার থেকে এটি ডাউনলোড করুন, অথবা লিখে জানান।",
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
      const { recording } = await Audio.Recording.createAsync(
        offlineStt ? STT_SPEECH_RECORDING : SPEECH_RECORDING,
      );
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

        <View className="flex-row rounded-2xl bg-card p-1">
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
                  if (item.id === mode || preparing) return;
                  modeRef.current = item.id;
                  if (isRecording) void handleToggleRecording();
                  chooseMode(item.id);
                  setError(null);
                }}
                className={`min-h-touch flex-1 items-center justify-center rounded-xl ${
                  active ? "bg-forest-700" : ""
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
          disabled={preparing || transcribing}
          transcript={transcript}
          onToggleRecording={() => {
            if (preparing) return;
            void handleToggleRecording();
          }}
          onChangeTranscript={setTranscript}
          preferTyping={mode === "text"}
          listeningLabel={
            preparing
              ? t("কণ্ঠ প্রস্তুত হচ্ছে…", "Getting the mic ready…")
              : transcribing
                ? t("কথা লেখা হচ্ছে…", "Writing your words…")
                : t("শুনছি… কথা বলুন", "Listening… speak now")
          }
          placeholder={
            mode === "text"
              ? t("এখানে বাংলায় লিখুন…", "Type in Bangla…")
              : t("মাইকে চাপুন, কথা বলুন, আবার চাপুন", "Tap mic, speak, tap again")
          }
        />

        {preparing ? (
          <AppText variant="caption" className="text-center text-primary">
            {t("কণ্ঠ প্রস্তুত হচ্ছে…", "Getting the mic ready…")}
          </AppText>
        ) : error ? (
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
          disabled={!transcript.trim() || transcribing || isRecording || preparing}
          loading={transcribing}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
