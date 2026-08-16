import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppText,
  ListenButton,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import type { SprayAdvisoryLevel, TreatmentPlan } from "@/types/treatment";

type IconName = ComponentProps<typeof Ionicons>["name"];

// TODO(nestjs): replace with a real GET /treatment-plan?diagnosisId=... call
// once the backend is wired. The disease name arriving via route params from
// DiagnosisResultScreen is already the right shape to key that request.
function getMockTreatmentPlan(diseaseNameBn?: string): TreatmentPlan {
  return {
    diseaseNameBn: diseaseNameBn || "বাদামি দাগ রোগ",
    pesticideNameBn: "প্রোপিকোনাজল ২৫% ইসি",
    dosagePerBigha: "৫০ মিলি/বিঘা",
    steps: [
      { step: 1, instructionBn: "১৬ লিটার পানির সাথে ৫০ মিলি ওষুধ মেশান।" },
      { step: 2, instructionBn: "মিশ্রণটি ভালোভাবে ঝাঁকিয়ে নিন।" },
      { step: 3, instructionBn: "বিকেলে রোদ কম থাকা অবস্থায় পুরো পাতায় স্প্রে করুন।" },
      { step: 4, instructionBn: "স্প্রে করার পর হাত ও মুখ ভালোভাবে ধুয়ে ফেলুন।" },
    ],
    safetyChecklist: [
      { id: "gloves", labelBn: "হাতে গ্লাভস পরুন" },
      { id: "mask", labelBn: "মুখে মাস্ক পরুন" },
      { id: "children", labelBn: "শিশুদের ক্ষেত থেকে দূরে রাখুন" },
      { id: "wind", labelBn: "বাতাসের বিপরীতে স্প্রে করবেন না" },
    ],
    followUpLabelBn: "৭ দিন পর আবার দেখুন",
    weatherAdvisory: {
      level: "caution",
      reasonBn: "আজ বিকেলে হালকা বৃষ্টির সম্ভাবনা আছে, সকালে স্প্রে করুন।",
    },
  };
}

const ADVISORY_STYLES: Record<
  SprayAdvisoryLevel,
  { bg: string; text: string; icon: IconName; color: string; label: string }
> = {
  safe: {
    bg: "bg-severity-low-bg",
    text: "text-severity-low",
    icon: "checkmark-circle",
    color: "#047857",
    label: "স্প্রে করা নিরাপদ",
  },
  caution: {
    bg: "bg-severity-medium-bg",
    text: "text-severity-medium",
    icon: "alert-circle",
    color: "#B54708",
    label: "সতর্কতার সাথে স্প্রে করুন",
  },
  wait: {
    bg: "bg-severity-high-bg",
    text: "text-severity-high",
    icon: "close-circle",
    color: "#B42318",
    label: "অপেক্ষা করুন",
  },
};

function WeatherAdvisoryCard({
  level,
  reasonBn,
}: {
  level: SprayAdvisoryLevel;
  reasonBn: string;
}) {
  const style = ADVISORY_STYLES[level];

  return (
    <View
      className={`flex-row items-center gap-3 rounded-3xl px-5 py-4 ${style.bg}`}
    >
      <Ionicons name={style.icon} size={26} color={style.color} />
      <View className="flex-1">
        <AppText variant="bodyLg" className={`font-bengali-bold ${style.text}`}>
          {style.label}
        </AppText>
        <AppText variant="body" className="mt-1 text-ink">
          {reasonBn}
        </AppText>
      </View>
    </View>
  );
}

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
  const params = useLocalSearchParams<{ diseaseNameBn?: string }>();
  const plan = useMemo(
    () => getMockTreatmentPlan(params.diseaseNameBn),
    [params.diseaseNameBn],
  );

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    {},
  );

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">চিকিৎসা পরিকল্পনা</AppText>
        <AppText variant="caption" className="mt-1">
          {plan.diseaseNameBn} এর জন্য সুপারিশকৃত পরিকল্পনা
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        <ListenButton
          label="পুরো পরিকল্পনা শুনুন"
          onPlay={() => {}}
          onPause={() => {}}
        />

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
              <AppText variant="caption" className="font-bengali-bold text-primary">
                {plan.followUpLabelBn}
              </AppText>
            </View>
          }
        >
          <View className="gap-5">
            <View>
              <AppText variant="caption">কীটনাশক</AppText>
              <AppText variant="bodyLg" className="font-bengali-bold text-primary">
                {plan.pesticideNameBn}
              </AppText>
              <AppText variant="body" className="mt-0.5 text-muted">
                মাত্রা: {plan.dosagePerBigha}
              </AppText>
            </View>

            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                মেশানোর ধাপ
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
              <AppText variant="body" className="mb-1 font-bengali-bold text-ink">
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
          label="খরচের হিসাব দেখুন"
          onPress={() => router.push("/(root)/(tabs)/scan/cost-estimator")}
          icon={
            <Ionicons name="calculator-outline" size={20} color={colors.ink} />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
