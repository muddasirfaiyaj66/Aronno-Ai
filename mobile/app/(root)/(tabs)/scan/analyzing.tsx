import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AIGeneratingShimmer, AppText, RetryCard } from "@/components/ui";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import {
  useCreatePhotoDiagnosisMutation,
  useCreateVoiceDiagnosisMutation,
  useIdentifyToolPhotoMutation,
  useIdentifyToolVoiceMutation,
  useScanReceiptMutation,
} from "@/services/api";

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

export default function AnalyzingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    imageUri?: string;
    flow?: string;
    source?: string;
    transcript?: string;
  }>();
  const flow: Flow =
    params.flow === "tool" || params.flow === "receipt"
      ? params.flow
      : "disease";
  const [statusIndex, setStatusIndex] = useState(0);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const statusLines = STATUS_LINES[flow];

  const [createPhotoDiagnosis] = useCreatePhotoDiagnosisMutation();
  const [createVoiceDiagnosis] = useCreateVoiceDiagnosisMutation();
  const [identifyToolPhoto] = useIdentifyToolPhotoMutation();
  const [identifyToolVoice] = useIdentifyToolVoiceMutation();
  const [scanReceipt] = useScanReceiptMutation();

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusLines.length);
    }, 1100);
    return () => clearInterval(id);
  }, [statusLines.length, error]);

  useEffect(() => {
    if (error) return;
    let cancelled = false;

    const run = async () => {
      try {
        if (flow === "tool") {
          const result = params.transcript
            ? await identifyToolVoice({ transcriptBn: params.transcript }).unwrap()
            : await identifyToolPhoto({
                imageUrl: await uploadImageToCloudinary(params.imageUri!),
              }).unwrap();
          if (cancelled) return;
          router.replace({
            pathname: "/(root)/(tabs)/scan/tool-result",
            params: { id: result.id },
          });
          return;
        }

        if (flow === "receipt") {
          const result = await scanReceipt({
            imageUrl: await uploadImageToCloudinary(params.imageUri!),
          }).unwrap();
          if (cancelled) return;
          router.replace({
            pathname: "/(root)/(tabs)/scan/receipt-result",
            params: { id: result.id },
          });
          return;
        }

        const result = params.transcript
          ? await createVoiceDiagnosis({
              transcriptBn: params.transcript,
            }).unwrap()
          : await createPhotoDiagnosis({
              imageUrl: await uploadImageToCloudinary(params.imageUri!),
            }).unwrap();
        if (cancelled) return;
        router.replace({
          pathname: "/(root)/(tabs)/scan/result",
          params: {
            id: result.id ?? "",
            diseaseNameBn: result.diseaseNameBn,
            diseaseNameEn: result.diseaseNameEn,
            confidence: String(result.confidence),
            severity: result.severity,
            imageUrl: result.imageUrl || params.imageUri || "",
          },
        });
      } catch {
        if (!cancelled) setError(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [flow, params.imageUri, params.transcript, router, error, attempt]);

  const handleRetry = () => {
    setError(false);
    setAttempt((a) => a + 1);
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
      {error ? (
        <RetryCard
          message="বিশ্লেষণ করা যায়নি। আবার চেষ্টা করুন।"
          onRetry={handleRetry}
        />
      ) : (
        <>
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
        </>
      )}
    </SafeAreaView>
  );
}
