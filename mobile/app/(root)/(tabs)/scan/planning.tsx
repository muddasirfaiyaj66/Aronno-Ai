import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  ForecastTimelineCard,
  ListenButton,
  PrimaryButton,
  RetryCard,
  ScreenHeader,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  getApiError,
  useGenerateCropPlanMutation,
  useGetLatestCropPlanQuery,
} from "@/services/api";
import { useFarmLocation } from "@/hooks/useFarmLocation";

export default function CropPlanningScreen() {
  const { data: latest, isLoading, isError, refetch } = useGetLatestCropPlanQuery();
  const [generate, { isLoading: generating }] = useGenerateCropPlanMutation();
  const [planError, setPlanError] = useState<string | null>(null);
  const location = useFarmLocation();
  const plan = latest;

  const requestPlan = async () => {
    setPlanError(null);
    try {
      await generate(location.coords ?? {}).unwrap();
    } catch (err) {
      setPlanError(
        getApiError(err).message ?? "পরিকল্পনা তৈরি করা যায়নি। আবার চেষ্টা করুন।",
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="আবহাওয়া–ফসল পরিকল্পনা"
        subtitle="আগামী ৬ মাসের পূর্বাভাস অনুযায়ী চাষের পরামর্শ"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 py-5 pb-16"
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {planError ? (
          <RetryCard message={planError} onRetry={requestPlan} />
        ) : isError ? (
          <RetryCard
            message="পরিকল্পনা তৈরি করা যায়নি। আবার চেষ্টা করুন।"
            onRetry={() => refetch()}
          />
        ) : isLoading || generating ? (
          <AIGeneratingShimmer
            label="পরিকল্পনা তৈরি হচ্ছে"
            lines={6}
            className="w-full"
          />
        ) : !plan ? (
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={32} color={colors.primary} />}
            message="এখনো কোনো ফসল পরিকল্পনা নেই। তৈরি করতে চাপুন।"
            ctaLabel="পরিকল্পনা তৈরি করুন"
            onCta={requestPlan}
          />
        ) : (
          <>
            <ForecastTimelineCard
              title="৬ মাসের পূর্বাভাস"
              subtitle="প্রতি মাসের আবহাওয়া, তাপমাত্রা, বৃষ্টি ও সুপারিশকৃত ফসল"
              months={plan.months.map((month, index) => ({
                id: `${month.month}-${index}`,
                monthLabel: month.month,
                weatherIcon: month.weatherIcon,
                cropLabel: month.recommendedCropBn,
                tempC: month.tempC,
                precipMm: month.precipMm,
              }))}
            />

            <StructuredCard
              title="চাষের পরামর্শ"
              icon={<Ionicons name="sparkles" size={22} color={colors.primary} />}
            >
              <AppText variant="body" className="leading-8 text-ink">
                {plan.recommendationBn}
              </AppText>
            </StructuredCard>

            <ListenButton
              label="সুপারিশ শুনুন"
              textBn={plan.recommendationBn}
            />

            <PrimaryButton label="আবার তৈরি করুন" onPress={requestPlan} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
