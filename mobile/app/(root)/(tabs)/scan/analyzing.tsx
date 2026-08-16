import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AIGeneratingShimmer, AppText } from "@/components/ui";
import type { DiagnosisResult } from "@/types/diagnosis";
import { MOCK_TOOL_RESULTS } from "@/types/tools";
import { MOCK_RECEIPT_SUMMARIES } from "@/types/receipt";

type Flow = "disease" | "tool" | "receipt";

const STATUS_LINES: Record<Flow, string[]> = {
  disease: [
    "ছবি বিশ্লেষণ করা হচ্ছে…",
    "রোগের ধরন শনাক্ত করা হচ্ছে…",
    "সুপারিশ তৈরি করা হচ্ছে…",
  ],
  tool: [
    "ছবি বিশ্লেষণ করা হচ্ছে…",
    "যন্ত্রের ধরন শনাক্ত করা হচ্ছে…",
    "বাজারে খোঁজ করা হচ্ছে…",
  ],
  receipt: [
    "রসিদ পড়া হচ্ছে…",
    "আইটেম আলাদা করা হচ্ছে…",
    "মোট হিসাব করা হচ্ছে…",
  ],
};

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
  const params = useLocalSearchParams<{ imageUri?: string; flow?: string }>();
  const flow: Flow =
    params.flow === "tool" || params.flow === "receipt"
      ? params.flow
      : "disease";
  const [statusIndex, setStatusIndex] = useState(0);
  const statusLines = STATUS_LINES[flow];

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusLines.length);
    }, 1100);
    return () => clearInterval(id);
  }, [statusLines.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (flow === "tool") {
        const mock =
          MOCK_TOOL_RESULTS[Math.floor(Math.random() * MOCK_TOOL_RESULTS.length)];
        router.replace({
          pathname: "/(root)/(tabs)/scan/tool-result",
          params: { id: mock.id },
        });
        return;
      }

      if (flow === "receipt") {
        const mock =
          MOCK_RECEIPT_SUMMARIES[
            Math.floor(Math.random() * MOCK_RECEIPT_SUMMARIES.length)
          ];
        router.replace({
          pathname: "/(root)/(tabs)/scan/receipt-result",
          params: { id: mock.id },
        });
        return;
      }

      const mock =
        MOCK_DIAGNOSES[Math.floor(Math.random() * MOCK_DIAGNOSES.length)];
      const result: DiagnosisResult = {
        ...mock,
        imageUrl: params.imageUri ?? mock.imageUrl,
      };

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
  }, [flow, params.imageUri, router]);

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
        {statusLines[statusIndex]}
      </AppText>
    </SafeAreaView>
  );
}
