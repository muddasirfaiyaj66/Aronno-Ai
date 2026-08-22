import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  AIGeneratingShimmer,
  EmptyState,
  PrimaryButton,
  RetryCard,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetLatestYieldQuery, usePredictYieldMutation } from "@/services/api";

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <AppText variant="caption">{label}</AppText>
      <AppText variant="body" className="font-bengali-semibold text-ink">
        {value}
      </AppText>
    </View>
  );
}

export default function YieldPredictionScreen() {
  const { data: latest, isLoading, isError, refetch } = useGetLatestYieldQuery();
  const [predict, { isLoading: predicting }] = usePredictYieldMutation();
  const estimate = latest;

  if (isLoading || predicting) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
        <AIGeneratingShimmer label="ফলন হিসাব হচ্ছে" lines={4} className="w-full" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-neutral px-5 py-5">
        <RetryCard message="ফলন তথ্য আনা যায়নি। আবার চেষ্টা করুন।" onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!estimate) {
    return (
      <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
        <View className="border-b border-neutral-200 bg-white px-5 py-4">
          <AppText variant="title">ফলন পূর্বাভাস</AppText>
          <AppText variant="caption" className="mt-1">
            আপনার জমি ও আবহাওয়ার তথ্যের ভিত্তিতে
          </AppText>
        </View>
        <EmptyState
          icon={<Ionicons name="stats-chart-outline" size={32} color={colors.primary} />}
          message="এখনো কোনো ফলন পূর্বাভাস নেই। হিসাব করতে চাপুন।"
          ctaLabel="ফলন হিসাব করুন"
          onCta={() => predict()}
        />
      </SafeAreaView>
    );
  }

  const trendIcon =
    estimate.trend === "up"
      ? "trending-up"
      : estimate.trend === "down"
        ? "trending-down"
        : "remove";
  const trendColor =
    estimate.trend === "up"
      ? "#047857"
      : estimate.trend === "down"
        ? "#B42318"
        : colors.muted;
  const trendLabel =
    estimate.trend === "up"
      ? `গত মৌসুমের চেয়ে ${estimate.changePercent}% বেশি`
      : estimate.trend === "down"
        ? `গত মৌসুমের চেয়ে ${estimate.changePercent}% কম`
        : "গত মৌসুমের সমান";

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">ফলন পূর্বাভাস</AppText>
        <AppText variant="caption" className="mt-1">
          আপনার জমি ও আবহাওয়ার তথ্যের ভিত্তিতে
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        <View className="gap-3 rounded-3xl bg-white p-4">
          <ReadOnlyRow label="ফসল" value={estimate.cropNameBn} />
          <ReadOnlyRow label="জমির পরিমাণ" value={estimate.landSizeBn} />
          <ReadOnlyRow label="আবহাওয়া" value={estimate.weatherSummaryBn} />
        </View>

        <StructuredCard
          title="আনুমানিক ফলন"
          icon={<Ionicons name="stats-chart" size={22} color={colors.primary} />}
        >
          <View className="gap-4">
            <View className="flex-row items-end gap-2">
              <AppText variant="hero">
                {estimate.estimatedMinMon}–{estimate.estimatedMaxMon}
              </AppText>
              <AppText variant="bodyLg" className="mb-2 text-muted">
                মণ
              </AppText>
            </View>

            <View className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3">
              <View>
                <AppText variant="caption">গত মৌসুমের ফলন</AppText>
                <AppText
                  variant="body"
                  className="mt-0.5 font-bengali-bold text-ink"
                >
                  {estimate.lastSeasonMon} মণ
                </AppText>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Ionicons name={trendIcon} size={18} color={trendColor} />
                <AppText
                  variant="caption"
                  className="font-bengali-semibold"
                  style={{ color: trendColor }}
                >
                  {trendLabel}
                </AppText>
              </View>
            </View>
          </View>
        </StructuredCard>

        <PrimaryButton label="আবার হিসাব করুন" onPress={() => predict()} />
      </ScrollView>
    </SafeAreaView>
  );
}
