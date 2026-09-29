import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AIGeneratingShimmer, EmptyState } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetHistoryEntryQuery } from "@/services/api";
import { getDiagnosisByAnyId } from "@/lib/offlineDb/queries";
import type { LocalDiagnosisRow } from "@/lib/offlineDb/schema";
import { useIsOnline } from "@/hooks/useIsOnline";

export default function HistoryDetailScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [localDiag, setLocalDiag] = useState<LocalDiagnosisRow | null>(null);
  const [localChecked, setLocalChecked] = useState(false);

  const { data: entry, isLoading, isError } = useGetHistoryEntryQuery(id!, {
    skip: !id || !online,
  });

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLocalChecked(true);
      return;
    }
    void getDiagnosisByAnyId(id)
      .then((row) => {
        if (!cancelled) setLocalDiag(row);
      })
      .catch(() => {
        if (!cancelled) setLocalDiag(null);
      })
      .finally(() => {
        if (!cancelled) setLocalChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!localChecked) return;

    // Prefer local SQLite row (works offline) — open full result with advice.
    if (localDiag) {
      router.replace({
        pathname: "/(root)/(tabs)/scan/result",
        params: {
          id: localDiag.serverId || localDiag.localId,
          diseaseNameBn: localDiag.diseaseNameBn,
          diseaseNameEn: localDiag.diseaseNameEn,
          confidence: String(localDiag.confidence),
          severity: localDiag.severity,
          imageUrl: localDiag.imageUri,
          verifiedBn: localDiag.verifiedBn ?? "",
          readOnly: "1",
        },
      });
      return;
    }

    if (entry) {
      router.replace({
        pathname: "/(root)/(tabs)/scan/result",
        params: {
          id: entry.sourceId ?? entry.id,
          diseaseNameBn: entry.diseaseNameBn,
          diseaseNameEn: entry.diseaseNameEn,
          confidence: String(entry.confidence),
          severity: entry.severity,
          imageUrl: entry.imageUrl,
          readOnly: "1",
        },
      });
    }
  }, [localChecked, localDiag, entry, router]);

  if (!localChecked || (online && isLoading && !localDiag)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
        <AIGeneratingShimmer label="লোড হচ্ছে" lines={3} className="w-full" />
      </SafeAreaView>
    );
  }

  // Disease entries redirect above — blank while navigating.
  if (localDiag || (entry && !isError)) {
    return <SafeAreaView className="flex-1 bg-neutral" edges={["top"]} />;
  }

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-neutral px-6"
      edges={["top"]}
    >
      <EmptyState
        icon={
          <Ionicons name="alert-circle-outline" size={32} color={colors.primary} />
        }
        message="এই তথ্য পাওয়া যায়নি।"
        ctaLabel="ফিরে যান"
        onCta={() => router.back()}
      />
    </SafeAreaView>
  );
}
