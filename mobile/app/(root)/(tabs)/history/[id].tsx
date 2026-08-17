import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppText,
  EmptyState,
  ListenButton,
  LoanStatusCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { getHistoryEntryById } from "@/types/history";

export default function HistoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useMemo(() => getHistoryEntryById(id), [id]);

  useEffect(() => {
    if (entry?.kind !== "disease") return;
    // DiagnosisResultScreen already knows how to render this shape (Sprint 1) —
    // reuse it in read-only mode instead of duplicating its layout here.
    router.replace({
      pathname: "/(root)/(tabs)/scan/result",
      params: {
        diseaseNameBn: entry.diseaseNameBn,
        diseaseNameEn: entry.diseaseNameEn,
        confidence: String(entry.confidence),
        severity: entry.severity,
        imageUrl: entry.imageUrl,
        readOnly: "1",
      },
    });
  }, [entry, router]);

  if (!entry) {
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

  if (entry.kind === "disease") {
    // Redirecting to DiagnosisResultScreen (read-only) — nothing to render here.
    return <SafeAreaView className="flex-1 bg-neutral" edges={["top"]} />;
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
          onPlay={() => {}}
          onPause={() => {}}
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
              <Ionicons
                name={
                  entry.trend === "up"
                    ? "trending-up"
                    : entry.trend === "down"
                      ? "trending-down"
                      : "remove"
                }
                size={22}
                color={
                  entry.trend === "up"
                    ? "#047857"
                    : entry.trend === "down"
                      ? "#B42318"
                      : colors.muted
                }
                style={{ marginBottom: 10 }}
              />
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
