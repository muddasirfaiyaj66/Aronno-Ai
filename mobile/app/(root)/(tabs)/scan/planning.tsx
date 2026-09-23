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
import { CostEstimatorPanel } from "@/components/cost/CostEstimatorPanel";
import { CultivationCostCard } from "@/components/cost/CultivationCostCard";
import { colors } from "@/constants/theme";
import {
  useGenerateCropPlanMutation,
  useGetLatestCropPlanQuery,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { useFarmLocation } from "@/hooks/useFarmLocation";
import type { CropType } from "@/types/treatment";

const toBn = (n: number) =>
  new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 }).format(n);

export default function CropPlanningScreen() {
  const { data: latest, isLoading, isError, refetch } = useGetLatestCropPlanQuery();
  const [generate, { isLoading: generating, data: generated }] =
    useGenerateCropPlanMutation();
  const [planError, setPlanError] = useState<string | null>(null);
  const location = useFarmLocation();
  const plan = latest;

  const requestPlan = async () => {
    setPlanError(null);
    try {
      await generate(location.coords ?? {}).unwrap();
    } catch (err) {
      setPlanError(userFacingError(err, "generic", "পরিকল্পনা তৈরি করা যায়নি। আবার চেষ্টা করুন।"));
    }
  };

  const priorityCrops = [
    ...new Set(
      (plan?.months ?? [])
        .map((m) => m.cropSlug)
        .filter((slug): slug is CropType => !!slug),
    ),
  ];
  const usedNormals =
    generated?.id === plan?.id && generated?.outlookSource === "climatology";

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
            {usedNormals ? (
              <AppText variant="caption" className="-mt-2 px-1 text-muted">
                মৌসুমি পূর্বাভাস এই মুহূর্তে পাওয়া যায়নি — বাংলাদেশের দীর্ঘমেয়াদি মাসিক
                গড় ব্যবহার করা হয়েছে।
              </AppText>
            ) : null}

            {plan.months.some((m) => m.plantingWindowBn) ? (
              <StructuredCard
                title="মাসভিত্তিক অগ্রাধিকার"
                icon={<Ionicons name="list-outline" size={22} color={colors.primary} />}
              >
                <View className="gap-3">
                  {plan.months.map((month, index) => (
                    <View
                      key={`${month.month}-${index}`}
                      className="gap-1 rounded-2xl bg-neutral px-4 py-3"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <AppText variant="body" className="font-bengali-bold text-ink">
                          {month.month}
                        </AppText>
                        <AppText variant="body" className="font-bengali-bold text-primary">
                          {month.recommendedCropBn}
                        </AppText>
                      </View>
                      {month.plantingWindowBn ? (
                        <AppText variant="caption" className="text-ink">
                          রোপণ/বোনা: {month.plantingWindowBn}
                        </AppText>
                      ) : null}
                      {month.harvestWindowBn ? (
                        <AppText variant="caption" className="text-ink">
                          কাটার সম্ভাব্য সময়: {month.harvestWindowBn}
                        </AppText>
                      ) : null}
                      {month.reasonBn ? (
                        <AppText variant="caption" className="text-muted">
                          {month.reasonBn}
                        </AppText>
                      ) : null}
                    </View>
                  ))}
                </View>
              </StructuredCard>
            ) : null}

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

            {plan.costEstimate ? (
              <CultivationCostCard
                cost={plan.costEstimate}
                caption={`প্রথম অগ্রাধিকার: ${plan.costEstimate.cropNameBn} · ${toBn(plan.costEstimate.landSizeBigha)} বিঘা ধরে`}
              />
            ) : null}

            <View className="gap-3">
              <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                আপনার জমির খরচ হিসাব করুন
              </AppText>
              <CostEstimatorPanel
                crops={priorityCrops}
                initialCrop={priorityCrops[0] ?? null}
                showSpray={false}
              />
            </View>

            <PrimaryButton label="আবার তৈরি করুন" onPress={requestPlan} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
