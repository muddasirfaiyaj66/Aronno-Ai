import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AIGeneratingShimmer, AppText, RetryCard } from "@/components/ui";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import {
  getApiError,
  useCreatePhotoDiagnosisMutation,
  useCreateVoiceDiagnosisMutation,
  useIdentifyToolPhotoMutation,
  useIdentifyToolVoiceMutation,
  useScanReceiptMutation,
} from "@/services/api";
import { fetchIsOnline } from "@/hooks/useIsOnline";
import { classifyLeaf, isDiseaseModelAvailable } from "@/lib/offlineVision/diseaseModel";
import { detectTool, isToolModelAvailable } from "@/lib/offlineVision/toolModel";
import {
  matchDiseaseFromTranscript,
  matchToolFromTranscript,
} from "@/lib/offlineNlu/offlineMatch";
import { logMetric } from "@/lib/offline/metrics";
import type { DiagnosisResult } from "@/types/diagnosis";
import type { ToolResult } from "@/types/tools";

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

function goDiagnosis(router: ReturnType<typeof useRouter>, result: DiagnosisResult, imageUri?: string) {
  router.replace({
    pathname: "/(root)/(tabs)/scan/result",
    params: {
      id: result.id ?? "",
      diseaseNameBn: result.diseaseNameBn,
      diseaseNameEn: result.diseaseNameEn,
      confidence: String(result.confidence),
      severity: result.severity,
      imageUrl: result.imageUrl || imageUri || "",
    },
  });
}

function goTool(router: ReturnType<typeof useRouter>, result: ToolResult) {
  router.replace({
    pathname: "/(root)/(tabs)/scan/tool-result",
    params: {
      id: result.id,
      toolNameBn: result.toolNameBn,
      toolNameEn: result.toolNameEn,
      reasonBn: result.reasonBn,
      offline: "1",
    },
  });
}

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
  const [errorMessage, setErrorMessage] = useState(
    "বিশ্লেষণ করা যায়নি। আবার চেষ্টা করুন।",
  );
  const [attempt, setAttempt] = useState(0);
  const statusLines = STATUS_LINES[flow];
  const onlineRef = useRef(true);

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

    const runOfflineDisease = async (): Promise<boolean> => {
      if (params.imageUri && (await isDiseaseModelAvailable())) {
        const result = await classifyLeaf(params.imageUri);
        if (result && !cancelled) {
          logMetric("analyzing.offline.disease.vision");
          goDiagnosis(router, result, params.imageUri);
          return true;
        }
      }
      if (params.transcript) {
        const matched = matchDiseaseFromTranscript(
          params.transcript,
          params.imageUri ?? "",
        );
        if (matched && !cancelled) {
          logMetric("analyzing.offline.disease.kb");
          goDiagnosis(router, matched, params.imageUri);
          return true;
        }
      }
      return false;
    };

    const runOfflineTool = async (): Promise<boolean> => {
      if (params.imageUri && (await isToolModelAvailable())) {
        const result = await detectTool(params.imageUri);
        if (result && !cancelled) {
          logMetric("analyzing.offline.tool.vision");
          goTool(router, result);
          return true;
        }
      }
      if (params.transcript) {
        const matched = matchToolFromTranscript(params.transcript);
        if (matched && !cancelled) {
          logMetric("analyzing.offline.tool.kb");
          goTool(router, matched);
          return true;
        }
      }
      return false;
    };

    const run = async () => {
      try {
        onlineRef.current = await fetchIsOnline();

        if (!onlineRef.current) {
          if (flow === "receipt") {
            throw new Error("অফলাইনে রসিদ স্ক্যান এখনো চালু নেই। ইন্টারনেট লাগবে।");
          }
          if (flow === "tool") {
            const ok = await runOfflineTool();
            if (ok) return;
            throw new Error(
              "অফলাইনে হাতিয়ার শনাক্ত হয়নি। মডেল কপি করুন অথবা নাম বলে/লিখে আবার চেষ্টা করুন।",
            );
          }
          const ok = await runOfflineDisease();
          if (ok) return;
          throw new Error(
            "অফলাইনে রোগ শনাক্ত হয়নি। crop_disease_int8.tflite কপি করুন, অথবা রোগের নাম বলে/লিখে চেষ্টা করুন।",
          );
        }

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
        goDiagnosis(router, result, params.imageUri);
      } catch (err) {
        if (cancelled) return;
        // Online Gemini failed → try offline vision/KB once
        if (onlineRef.current && flow !== "receipt") {
          try {
            const ok =
              flow === "tool" ? await runOfflineTool() : await runOfflineDisease();
            if (ok) return;
          } catch {
            // fall through
          }
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : getApiError(err).message ?? "বিশ্লেষণ করা যায়নি। আবার চেষ্টা করুন।",
        );
        setError(true);
      }
    };

    void run();
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
        <RetryCard message={errorMessage} onRetry={handleRetry} />
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
