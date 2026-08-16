import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, PrimaryButton, VoiceInputWidget } from "@/components/ui";

const FLOW_CONTENT: Record<
  string,
  { subtitle: string; mockTranscript: string }
> = {
  disease: {
    subtitle: "ফসলের সমস্যাটি বাংলায় বলুন",
    mockTranscript:
      "আমার ধানের পাতায় বাদামি দাগ দেখা যাচ্ছে, পাতাগুলো ধীরে ধীরে শুকিয়ে যাচ্ছে।",
  },
  tool: {
    subtitle: "আপনার কাজটি বাংলায় বলুন",
    mockTranscript:
      "আমার জমিতে ঘাস কাটার জন্য একটা যন্ত্র দরকার, হাত দিয়ে কাটতে অনেক কষ্ট হচ্ছে।",
  },
};

export default function VoiceCaptureScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const content = FLOW_CONTENT[flow ?? "disease"] ?? FLOW_CONTENT.disease;
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
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">কথা বলুন</AppText>
        <AppText variant="caption" className="mt-1">
          {content.subtitle}
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="min-h-[96px] items-center justify-center rounded-3xl bg-white px-5 py-6">
          <AppText
            variant="display"
            className={`text-center ${transcript ? "text-ink" : "text-muted"}`}
          >
            {transcript || "আপনার কথা এখানে লেখা আকারে দেখা যাবে…"}
          </AppText>
        </View>

        <VoiceInputWidget
          isRecording={isRecording}
          transcript={transcript}
          onToggleRecording={handleToggleRecording}
          onChangeTranscript={setTranscript}
        />

        <AppText variant="caption" className="text-center">
          জমা দেওয়ার আগে লেখাটি পড়ে নিশ্চিত করুন। প্রয়োজনে সম্পাদনা করুন।
        </AppText>

        <PrimaryButton
          label="জমা দিন"
          onPress={handleSubmit}
          disabled={!transcript.trim()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
