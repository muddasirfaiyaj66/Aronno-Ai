import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AIGeneratingShimmer, AppText } from "@/components/ui";
import type { DiagnosisResult } from "@/types/diagnosis";

const STATUS_LINES = [
  "ছবি বিশ্লেষণ করা হচ্ছে…",
  "রোগের ধরন শনাক্ত করা হচ্ছে…",
  "সুপারিশ তৈরি করা হচ্ছে…",
];

const MOCK_DIAGNOSES: DiagnosisResult[] = [
  {
    diseaseNameBn: "বাদামি দাগ রোগ",
    diseaseNameEn: "Brown Spot Disease",
    confidence: 87,
    severity: "medium",
    imageUrl: "",
  },
  {
    diseaseNameBn: "পাতা ঝলসানো রোগ",
    diseaseNameEn: "Leaf Blight",
    confidence: 74,
    severity: "high",
    imageUrl: "",
  },
  {
    diseaseNameBn: "সুস্থ পাতা",
    diseaseNameEn: "Healthy Leaf",
    confidence: 95,
    severity: "low",
    imageUrl: "",
  },
];

export default function AnalyzingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string }>();
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_LINES.length);
    }, 1100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mock =
      MOCK_DIAGNOSES[Math.floor(Math.random() * MOCK_DIAGNOSES.length)];
    const result: DiagnosisResult = {
      ...mock,
      imageUrl: params.imageUri ?? mock.imageUrl,
    };

    const timer = setTimeout(() => {
      router.replace({
        pathname: "/(root)/(tabs)/scan/result",
        params: {
          diseaseNameBn: result.diseaseNameBn,
          diseaseNameEn: result.diseaseNameEn,
          confidence: String(result.confidence),
          severity: result.severity,
          imageUrl: result.imageUrl,
        },
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, [params.imageUri, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
      <AIGeneratingShimmer
        label="AI বিশ্লেষণ করছে"
        lines={4}
        className="w-full"
      />
      <AppText
        variant="body"
        className="mt-6 text-center font-bengali-semibold text-primary"
      >
        {STATUS_LINES[statusIndex]}
      </AppText>
    </SafeAreaView>
  );
}
