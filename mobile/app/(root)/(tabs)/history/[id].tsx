import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  ListenButton,
  LoanStatusCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
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
          id: localDiag.localId,
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

    if (entry?.kind === "disease") {
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

  // Disease path redirects above — blank while navigating.
  if (localDiag || entry?.kind === "disease") {
    return <SafeAreaView className="flex-1 bg-neutral" edges={["top"]} />;
  }

  if (!entry || isError) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-neutral px-6"
        edges={["top"]}
      >
        <EmptyState
          icon={
            <Ionicons
              name="alert-circle-outline"
              size={32}
              color={colors.primary}
            />
          }
          message="এই তথ্য পাওয়া যায়নি।"
          ctaLabel="ফিরে যান"
          onCta={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">বিস্তারিত</AppText>
        <AppText variant="caption" className="mt-1">
          {entry.dateBn}
        </AppText>
      </View>

      <View className="flex-1 gap-4 px-5 py-5">
        <ListenButton
          label="বিস্তারিত শুনুন"
          textBn={
            entry.kind === "yield"
              ? `${entry.cropNameBn} ফলন ${entry.yieldValue} ${entry.yieldUnitBn}`
              : `${entry.title} ${entry.amount}`
          }
        />

        {entry.kind === "yield" ? (
          <StructuredCard
            title={`${entry.cropNameBn} · ফলন পূর্বাভাস`}
            icon={
              <Ionicons name="stats-chart" size={22} color={colors.primary} />
            }
          >
            <View className="flex-row items-end gap-3">
              <AppText variant="hero">{entry.yieldValue}</AppText>
              <AppText variant="bodyLg" className="mb-2 text-muted">
                {entry.yieldUnitBn}
              </AppText>
            </View>
          </StructuredCard>
        ) : (
          <LoanStatusCard
            title={entry.title}
            amount={entry.amount}
            status={entry.status}
            nextPaymentLabel="পরবর্তী কিস্তি"
            nextPaymentDate={entry.nextPaymentDate}
          />
        )}

        <SecondaryButton
          label="ফিরে যান"
          onPress={() => router.back()}
          icon={<Ionicons name="arrow-back" size={20} color={colors.ink} />}
        />
      </View>
    </SafeAreaView>
  );
}
