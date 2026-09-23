import { useEffect, useRef, useState } from "react";
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
import { userFacingError } from "@/lib/userFacingError";
import { fetchIsOnline } from "@/hooks/useIsOnline";
import { classifyLeaf, isDiseaseModelAvailable } from "@/lib/offlineVision/diseaseModel";
import { detectTool, isToolModelAvailable } from "@/lib/offlineVision/toolModel";
import {
  classifyLeafWithGemma,
  detectToolWithGemma,
  isGemmaVisionAvailable,
  scanReceiptWithGemma,
} from "@/lib/offlineVision/gemmaVision";
import {
  matchDiseaseFromTranscript,
  matchToolFromTranscript,
} from "@/lib/offlineNlu/offlineMatch";
import { verifyScanResult } from "@/lib/offlineChat/verifyScan";
import {
  insertDiagnosis,
  insertTool,
  updateDiagnosisVerified,
} from "@/lib/offlineDb/queries";
import { requestSyncSoon } from "@/lib/offlineDb/syncEngine";
import { speakOffline } from "@/lib/offlineVoice/ttsEngine";
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

    const finalizeDisease = async (result: DiagnosisResult) => {
      const labelId =
        result.id?.replace(/^offline-/, "") ?? result.diseaseNameEn;
      const row = await insertDiagnosis({
        labelId,
        diseaseNameBn: result.diseaseNameBn,
        diseaseNameEn: result.diseaseNameEn,
        confidence: result.confidence,
        severity: result.severity,
        imageUri: result.imageUrl || params.imageUri || "",
        verifiedBn: null,
        source: params.transcript ? "offline_voice" : "offline_photo",
      });
      const withLocalId: DiagnosisResult = {
        ...result,
        id: row.localId,
        imageUrl: result.imageUrl || params.imageUri || "",
      };
      if (!cancelled) goDiagnosis(router, withLocalId, params.imageUri);

      // Gemma cross-check (non-blocking for navigation)
      void (async () => {
        const verified = await verifyScanResult({
          kind: "disease",
          labelId,
          nameBn: result.diseaseNameBn,
          nameEn: result.diseaseNameEn,
          confidence: result.confidence,
        });
        const note =
          verified.deepExplanationBn || verified.noteBn || "";
        if (note) {
          await updateDiagnosisVerified(row.localId, note).catch(() => undefined);
          void speakOffline(note.slice(0, 400));
        }
        requestSyncSoon();
      })();
      requestSyncSoon();
    };

    const finalizeTool = async (result: ToolResult) => {
      const labelId = result.id.replace(/^offline-/, "");
      const row = await insertTool({
        labelId,
        toolNameBn: result.toolNameBn,
        toolNameEn: result.toolNameEn,
        reasonBn: result.reasonBn,
        imageUri: params.imageUri ?? "",
        verifiedBn: null,
      });
      if (!cancelled) {
        goTool(router, { ...result, id: row.localId });
      }
      void (async () => {
        const verified = await verifyScanResult({
          kind: "tool",
          labelId,
          nameBn: result.toolNameBn,
          nameEn: result.toolNameEn,
          confidence: 80,
        });
        const note = verified.deepExplanationBn || verified.noteBn || "";
        if (note) void speakOffline(note.slice(0, 400));
        requestSyncSoon();
      })();
      requestSyncSoon();
    };

    const runOfflineDisease = async (): Promise<boolean> => {
      if (params.imageUri && (await isDiseaseModelAvailable())) {
        const result = await classifyLeaf(params.imageUri);
        if (result && !cancelled) {
          logMetric("analyzing.offline.disease.vision");
          await finalizeDisease(result);
          return true;
        }
      }
      // Gemma 3 multimodal fallback (slower, needs 4B+mmproj)
      if (params.imageUri && (await isGemmaVisionAvailable())) {
        const result = await classifyLeafWithGemma(params.imageUri);
        if (result && !cancelled) {
          logMetric("analyzing.offline.disease.gemma");
          await finalizeDisease(result);
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
          await finalizeDisease(matched);
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
          await finalizeTool(result);
          return true;
        }
      }
      if (params.imageUri && (await isGemmaVisionAvailable())) {
        const result = await detectToolWithGemma(params.imageUri);
        if (result && !cancelled) {
          logMetric("analyzing.offline.tool.gemma");
          await finalizeTool(result);
          return true;
        }
      }
      if (params.transcript) {
        const matched = matchToolFromTranscript(params.transcript);
        if (matched && !cancelled) {
          logMetric("analyzing.offline.tool.kb");
          await finalizeTool(matched);
          return true;
        }
      }
      return false;
    };

    const runOfflineReceipt = async (): Promise<boolean> => {
      if (!params.imageUri) return false;
      if (!(await isGemmaVisionAvailable())) return false;
      const summary = await scanReceiptWithGemma(params.imageUri);
      if (!summary || cancelled) return false;
      logMetric("analyzing.offline.receipt.gemma");
      router.replace({
        pathname: "/(root)/(tabs)/scan/receipt-result",
        params: {
          offline: "1",
          id: summary.id,
          totalBdt: String(summary.totalBdt),
          summaryBn: summary.summaryBn,
          itemsJson: JSON.stringify(summary.items),
        },
      });
      return true;
    };

    const run = async () => {
      try {
        onlineRef.current = await fetchIsOnline();

        // Prefer on-device TFLite when available — much faster than Cloudinary + Gemini.
        if (flow === "disease") {
          const localOk = await runOfflineDisease();
          if (localOk) return;
        }
        if (flow === "tool") {
          const localOk = await runOfflineTool();
          if (localOk) return;
        }

        if (!onlineRef.current) {
          if (flow === "receipt") {
            const ok = await runOfflineReceipt();
            if (ok) return;
            throw new Error("OFFLINE_RECEIPT");
          }
          if (flow === "tool") {
            throw new Error("OFFLINE_TOOL");
          }
          throw new Error("OFFLINE_DISEASE");
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
        try {
          await insertDiagnosis({
            labelId: result.diseaseNameEn || result.diseaseNameBn,
            diseaseNameBn: result.diseaseNameBn,
            diseaseNameEn: result.diseaseNameEn,
            confidence: result.confidence,
            severity: result.severity,
            imageUri: result.imageUrl || params.imageUri || "",
            verifiedBn: null,
            source: params.transcript ? "voice" : "photo",
            syncStatus: "synced",
            localId: result.id,
          });
        } catch {
          // ignore local mirror failure
        }
        goDiagnosis(router, result, params.imageUri);
      } catch (err) {
        if (cancelled) return;
        // Online Gemini failed → try offline vision/KB once
        if (onlineRef.current) {
          try {
            if (flow === "receipt") {
              const ok = await runOfflineReceipt();
              if (ok) return;
            } else {
              const ok =
                flow === "tool" ? await runOfflineTool() : await runOfflineDisease();
              if (ok) return;
            }
          } catch {
            // fall through
          }
        }
        const ctx =
          flow === "tool"
            ? "analyze-tool"
            : flow === "receipt"
              ? "analyze-receipt"
              : "analyze-disease";
        setErrorMessage(userFacingError(err, ctx));
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
            label="বিশ্লেষণ চলছে"
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
