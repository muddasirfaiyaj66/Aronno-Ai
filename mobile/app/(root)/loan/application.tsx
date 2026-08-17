import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  IconPickerRow,
  LoanStatusBadge,
  PrimaryButton,
  SegmentedTabs,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  LOAN_PURPOSE_LABELS,
  REPAYMENT_PERIOD_LABELS,
  type LoanPurpose,
  type RepaymentPeriod,
} from "@/types/loan";

const PURPOSE_OPTIONS: {
  id: LoanPurpose;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "seed", label: LOAN_PURPOSE_LABELS.seed, icon: "leaf-outline" },
  { id: "fertilizer", label: LOAN_PURPOSE_LABELS.fertilizer, icon: "flask-outline" },
  { id: "equipment", label: LOAN_PURPOSE_LABELS.equipment, icon: "construct-outline" },
  { id: "other", label: LOAN_PURPOSE_LABELS.other, icon: "ellipsis-horizontal-circle-outline" },
];

const PERIOD_OPTIONS: { id: RepaymentPeriod; label: string }[] = [
  { id: "3m", label: REPAYMENT_PERIOD_LABELS["3m"] },
  { id: "6m", label: REPAYMENT_PERIOD_LABELS["6m"] },
  { id: "12m", label: REPAYMENT_PERIOD_LABELS["12m"] },
];

const BN_TO_EN_DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

/** Accepts both Bangla and Latin numerals typed into the amount field. */
function parseAmount(value: string) {
  return Number(value.replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d));
}

export default function LoanApplicationScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState<LoanPurpose | null>(null);
  const [period, setPeriod] = useState<RepaymentPeriod>("6m");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = parseAmount(amount) > 0 && !!purpose;

  // TODO(nestjs): replace with a real POST /loan/apply call once the
  // backend is wired.
  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">নতুন ঋণ আবেদন</AppText>
        <AppText variant="caption" className="mt-1">
          পরিমাণ ও উদ্দেশ্য জানিয়ে আবেদন করুন
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-5"
        keyboardShouldPersistTaps="handled"
      >
        {submitted ? (
          <StructuredCard
            title="আবেদন জমা হয়েছে"
            icon={
              <Ionicons
                name="document-text"
                size={22}
                color={colors.primary}
              />
            }
            footer={
              <PrimaryButton
                label="ওভারভিউতে ফিরুন"
                onPress={() => router.replace("/(root)/loan/overview")}
              />
            }
          >
            <View className="gap-4">
              <LoanStatusBadge status="pending" />
              <View>
                <AppText variant="caption">অনুরোধকৃত পরিমাণ</AppText>
                <AppText variant="hero">৳ {amount}</AppText>
              </View>
              <View className="flex-row justify-between rounded-2xl bg-neutral px-4 py-3">
                <View>
                  <AppText variant="caption">উদ্দেশ্য</AppText>
                  <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                    {purpose ? LOAN_PURPOSE_LABELS[purpose] : ""}
                  </AppText>
                </View>
                <View>
                  <AppText variant="caption">পরিশোধের মেয়াদ</AppText>
                  <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                    {REPAYMENT_PERIOD_LABELS[period]}
                  </AppText>
                </View>
              </View>
            </View>
          </StructuredCard>
        ) : (
          <>
            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                অনুরোধকৃত পরিমাণ (৳)
              </AppText>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="যেমনঃ ৩০০০০"
                placeholderTextColor={colors.muted}
                accessibilityLabel="অনুরোধকৃত পরিমাণ, টাকা"
                className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
              />
            </View>

            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                উদ্দেশ্য
              </AppText>
              <IconPickerRow
                options={PURPOSE_OPTIONS.map((p) => ({
                  id: p.id,
                  label: p.label,
                  icon: <Ionicons name={p.icon} size={22} color={colors.primary} />,
                }))}
                value={purpose}
                onChange={(id) => setPurpose(id as LoanPurpose)}
              />
            </View>

            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                পরিশোধের মেয়াদ
              </AppText>
              <SegmentedTabs
                options={PERIOD_OPTIONS}
                value={period}
                onChange={setPeriod}
              />
            </View>

            <PrimaryButton
              label="আবেদন জমা দিন"
              onPress={handleSubmit}
              disabled={!canSubmit}
              icon={
                <Ionicons name="send-outline" size={20} color={colors.white} />
              }
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
