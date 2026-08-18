import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AIGeneratingShimmer,
  AppText,
  ForecastTimelineCard,
  ListenButton,
  RetryCard,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useGenerateCropPlanMutation,
  useSpeakMutation,
} from "@/services/api";

export default function CropPlanningScreen() {
  const [generate, { data: plan, isLoading, isError }] =
    useGenerateCropPlanMutation();
  const [speak] = useSpeakMutation();

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">আবহাওয়া–ফসল পরিকল্পনা</AppText>
        <AppText variant="caption" className="mt-1">
          আগামী ৬ মাসের পূর্বাভাস অনুযায়ী চাষের পরামর্শ
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        {isError ? (
          <RetryCard
            message="পরিকল্পনা তৈরি করা যায়নি। আবার চেষ্টা করুন।"
            onRetry={() => generate()}
          />
        ) : isLoading || !plan ? (
          <AIGeneratingShimmer
            label="পরিকল্পনা তৈরি হচ্ছে"
            lines={4}
            className="w-full"
          />
        ) : (
          <>
            <ForecastTimelineCard
              title="৬ মাসের পূর্বাভাস"
              subtitle="মাসভিত্তিক আবহাওয়া ও সুপারিশকৃত ফসল"
              months={plan.months.map((month, index) => ({
                id: `${month.month}-${index}`,
                monthLabel: month.month,
                weatherIcon: month.weatherIcon,
                cropLabel: month.recommendedCropBn,
              }))}
            />

            <StructuredCard
              title="AI সুপারিশ"
              icon={<Ionicons name="sparkles" size={22} color={colors.primary} />}
              footer={
                <ListenButton
                  label="সুপারিশ শুনুন"
                  onPlay={() => speak({ textBn: plan.recommendationBn })}
                />
              }
            >
              <AppText variant="body" className="leading-6 text-ink">
                {plan.recommendationBn}
              </AppText>
            </StructuredCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
