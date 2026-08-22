import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppText,
  PrimaryButton,
  ScreenHeader,
  VoiceInputWidget,
} from "@/components/ui";
import { useLocale } from "@/context/locale";

const FLOW_CONTENT: Record<
  string,
  { subtitle: string; mockTranscript: string }
> = {
  disease: {
    subtitle: "ফসলের সমস্যাটি বাংলায় বলুন, অথবা নিচে লিখুন",
    mockTranscript:
      "আমার ধানের পাতায় বাদামি দাগ দেখা যাচ্ছে, পাতাগুলো ধীরে ধীরে শুকিয়ে যাচ্ছে।",
  },
  tool: {
    subtitle: "আপনার কাজটি বাংলায় বলুন, অথবা নিচে লিখুন",
    mockTranscript:
      "আমার জমিতে ঘাস কাটার জন্য একটা যন্ত্র দরকার, হাত দিয়ে কাটতে অনেক কষ্ট হচ্ছে।",
  },
};

type Mode = "voice" | "text";

export default function VoiceCaptureScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { flow, mode: modeParam } = useLocalSearchParams<{
    flow?: string;
    mode?: string;
  }>();
  const content = FLOW_CONTENT[flow ?? "disease"] ?? FLOW_CONTENT.disease;
  const [mode, setMode] = useState<Mode>(modeParam === "text" ? "text" : "voice");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleToggleRecording = () => {
    if (isRecording) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    timeoutRef.current = setTimeout(() => {
      setTranscript((prev) => (prev.trim() ? prev : content.mockTranscript));
      setIsRecording(false);
    }, 1600);
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
          onToggleRecording={handleToggleRecording}
          onChangeTranscript={setTranscript}
          preferTyping={mode === "text"}
          placeholder={
            mode === "text"
              ? t("এখানে বাংলায় লিখুন…", "Type in Bangla…")
              : t("মাইকে চাপুন, তারপর কথা বলুন", "Tap the mic, then speak")
          }
        />

        <AppText variant="caption" className="text-center leading-6">
          {t(
            "জমা দেওয়ার আগে লেখাটি পড়ে নিন। ভুল হলে «সম্পাদনা» চাপুন।",
            "Read the text before sending. Tap Edit if it is wrong.",
          )}
        </AppText>

        <PrimaryButton
          label={t("জমা দিন", "Submit")}
          onPress={handleSubmit}
          disabled={!transcript.trim()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
