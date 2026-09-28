import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  ListenButton,
  RetryCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { WeatherAdvisoryCard } from "@/components/treatment/WeatherAdvisoryCard";
import { colors } from "@/constants/theme";
import type { SeverityLevel } from "@/types/diagnosis";
import { useGetTreatmentPlanQuery } from "@/services/api";
import { buildOfflineTreatmentPlan } from "@/lib/offlineNlu/offlineTreatment";
import { useIsOnline } from "@/hooks/useIsOnline";

function SafetyChecklistRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="min-h-touch flex-row items-center gap-3 py-1"
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={24}
        color={checked ? colors.primary : colors.muted}
      />
      <AppText variant="body" className="flex-1 text-ink">
        {label}
      </AppText>
    </Pressable>
  );
}

export default function TreatmentPlanScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const params = useLocalSearchParams<{
    diseaseNameBn?: string;
    diseaseNameEn?: string;
    severity?: SeverityLevel;
    diagnosisId?: string;
  }>();

  const diagnosisId = params.diagnosisId?.trim() ?? "";
  // Server UUIDs only — local offline ids like "diag-…" skip the API.
  const looksLikeServerId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      diagnosisId,
    );

  const {
    data: remotePlan,
    isLoading,
    isError,
    refetch,
  } = useGetTreatmentPlanQuery(diagnosisId, {
    skip: !looksLikeServerId || !online,
  });

  const offlinePlan = useMemo(
    () =>
      buildOfflineTreatmentPlan(
        params.diseaseNameBn,
        params.diseaseNameEn,
        params.severity ?? "medium",
      ),
    [params.diseaseNameBn, params.diseaseNameEn, params.severity],
  );

  const plan = remotePlan ?? offlinePlan;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const listenText = useMemo(
    () =>
      plan
        ? `${plan.diseaseNameBn}. ${plan.pesticideNameBn}. ${plan.steps.map((s) => s.instructionBn).join(" ")}`
        : "",
    [plan],
  );

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (looksLikeServerId && online && isLoading && !plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
        <AIGeneratingShimmer
          label="পরিকল্পনা তৈরি হচ্ছে"
          lines={5}
          className="w-full"
        />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
        <RetryCard
          message={
            isError
              ? "পরিকল্পনা আনা যায়নি।"
              : "এই রোগের চিকিৎসা পরিকল্পনা পাওয়া যায়নি।"
          }
          onRetry={() => {
            if (looksLikeServerId && online) void refetch();
            else router.back();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-card px-5 py-4">
        <AppText variant="title">চিকিৎসা পরিকল্পনা</AppText>
        <AppText variant="caption" className="mt-1">
          {plan.diseaseNameBn} এর জন্য সুপারিশকৃত পরিকল্পনা
          {!remotePlan && offlinePlan ? " · অফলাইন" : ""}
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-10"
      >
        <ListenButton label="পুরো পরিকল্পনা শুনুন" textBn={listenText} />

        <WeatherAdvisoryCard
          level={plan.weatherAdvisory.level}
          reasonBn={plan.weatherAdvisory.reasonBn}
        />

        <StructuredCard
          title="চিকিৎসা ধাপ"
          icon={<Ionicons name="medkit" size={22} color={colors.primary} />}
          footer={
            <View className="flex-row items-center gap-2 self-start rounded-full bg-secondary px-4 py-2">
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.primary}
              />
              <AppText
                variant="caption"
                className="font-bengali-bold text-primary"
              >
                {plan.followUpLabelBn}
              </AppText>
            </View>
          }
        >
          <View className="gap-5">
            <View>
              <AppText variant="caption">কীটনাশক / ওষুধ</AppText>
              <AppText
                variant="bodyLg"
                className="font-bengali-bold text-primary"
              >
                {plan.pesticideNameBn}
              </AppText>
              <AppText variant="body" className="mt-0.5 text-muted">
                মাত্রা: {plan.dosagePerBigha}
              </AppText>
            </View>

            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                করণীয় ধাপ
              </AppText>
              {plan.steps.map((step) => (
                <View key={step.step} className="flex-row items-start gap-3">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-secondary">
                    <AppText
                      variant="caption"
                      className="font-bengali-bold text-primary"
                    >
                      {step.step}
                    </AppText>
                  </View>
                  <AppText variant="body" className="flex-1 leading-6 text-ink">
                    {step.instructionBn}
                  </AppText>
                </View>
              ))}
            </View>

            <View className="gap-1">
              <AppText
                variant="body"
                className="mb-1 font-bengali-bold text-ink"
              >
                নিরাপত্তা চেকলিস্ট
              </AppText>
              {plan.safetyChecklist.map((item) => (
                <SafetyChecklistRow
                  key={item.id}
                  label={item.labelBn}
                  checked={!!checkedItems[item.id]}
                  onToggle={() => toggleItem(item.id)}
                />
              ))}
            </View>
          </View>
        </StructuredCard>

        <SecondaryButton
          label="সম্পূর্ণ রিপোর্ট দেখুন"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/report",
              params: {
                diagnosisId: diagnosisId || plan.id || "",
                diseaseNameBn: plan.diseaseNameBn,
                diseaseNameEn: params.diseaseNameEn ?? "",
                severity: params.severity,
              },
            })
          }
          icon={
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.ink}
            />
          }
        />

        <SecondaryButton
          label="খরচের হিসাব দেখুন"
          onPress={() => router.push("/(root)/(tabs)/scan/cost-estimator")}
          icon={
            <Ionicons name="calculator-outline" size={20} color={colors.ink} />
          }
        />

        <SecondaryButton
          label="ফিরে যান"
          onPress={() => router.back()}
          icon={<Ionicons name="arrow-back" size={20} color={colors.ink} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
