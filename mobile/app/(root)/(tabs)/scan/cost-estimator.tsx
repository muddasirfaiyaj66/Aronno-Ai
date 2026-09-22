import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AIGeneratingShimmer,
  AppText,
  IconPickerRow,
  PrimaryButton,
  RetryCard,
  SegmentedTabs,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import type {
  CostEstimateResult,
  CropType,
  LandUnit,
} from "@/types/treatment";
import {
  useCreateCostEstimateMutation,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";

const CROP_OPTIONS: { id: CropType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "rice", label: "ধান", icon: "leaf-outline" },
  { id: "potato", label: "আলু", icon: "ellipse-outline" },
  { id: "tomato", label: "টমেটো", icon: "nutrition-outline" },
  { id: "vegetable", label: "সবজি", icon: "basket-outline" },
];

const UNIT_OPTIONS: { id: LandUnit; label: string }[] = [
  { id: "bigha", label: "বিঘা" },
  { id: "acre", label: "একর" },
];

export default function CostEstimatorScreen() {
  const [cropType, setCropType] = useState<CropType | null>(null);
  const [landSize, setLandSize] = useState("");
  const [landUnit, setLandUnit] = useState<LandUnit>("bigha");
  const [result, setResult] = useState<CostEstimateResult | null>(null);
  const [createEstimate, { isLoading }] = useCreateCostEstimateMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedLandSize = Number(landSize);
  const canSubmit = !!cropType && parsedLandSize > 0;

  const cropLabel = useMemo(
    () => CROP_OPTIONS.find((c) => c.id === cropType)?.label ?? "",
    [cropType],
  );

  const handleSubmit = async () => {
    if (!canSubmit || !cropType) return;
    setErrorMessage(null);
    try {
      const data = await createEstimate({
        cropSlug: cropType,
        landSize: parsedLandSize,
        landUnit,
      }).unwrap();
      setResult(data);
    } catch (err) {
      setResult(null);
      setErrorMessage(
        userFacingError(err, "generic", "খরচ হিসাব করা যায়নি। আবার চেষ্টা করুন।"),
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">খরচের হিসাব</AppText>
        <AppText variant="caption" className="mt-1">
          ফসল ও জমির পরিমাণ দিয়ে আনুমানিক খরচ জানুন
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            ফসলের ধরন
          </AppText>
          <IconPickerRow
            options={CROP_OPTIONS.map((c) => ({
              id: c.id,
              label: c.label,
              icon: <Ionicons name={c.icon} size={22} color={colors.primary} />,
            }))}
            value={cropType}
            onChange={(id) => setCropType(id as CropType)}
          />
        </View>

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            জমির পরিমাণ
          </AppText>
          <View className="flex-row items-center gap-3">
            <TextInput
              value={landSize}
              onChangeText={setLandSize}
              keyboardType="numeric"
              placeholder="যেমনঃ ২"
              placeholderTextColor={colors.muted}
              accessibilityLabel="জমির পরিমাণ"
              className="min-h-touch-lg flex-1 rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
            />
            <SegmentedTabs
              options={UNIT_OPTIONS}
              value={landUnit}
              onChange={setLandUnit}
            />
          </View>
        </View>

        <PrimaryButton
          label="হিসাব করুন"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          icon={
            <Ionicons name="calculator-outline" size={20} color={colors.white} />
          }
        />

        {errorMessage ? (
          <RetryCard message={errorMessage} onRetry={handleSubmit} />
        ) : null}

        {isLoading ? (
          <AIGeneratingShimmer label="খরচ হিসাব হচ্ছে" lines={3} className="w-full" />
        ) : null}

        {result ? (
          <StructuredCard
            title="আনুমানিক খরচ"
            icon={
              <Ionicons name="cash-outline" size={22} color={colors.primary} />
            }
          >
            <View className="gap-4">
              <View>
                <AppText variant="caption">
                  {cropLabel} · {landSize} {landUnit === "bigha" ? "বিঘা" : "একর"}
                </AppText>
                <AppText variant="hero">৳ {result.totalCostBdt}</AppText>
              </View>

              <View className="flex-row justify-between rounded-2xl bg-neutral px-4 py-3">
                <View>
                  <AppText variant="caption">কীটনাশকের পরিমাণ</AppText>
                  <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                    {result.pesticideQuantity}
                  </AppText>
                </View>
                <View>
                  <AppText variant="caption">স্প্রে সংখ্যা</AppText>
                  <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                    {result.spraySessions} বার
                  </AppText>
                </View>
              </View>
            </View>
          </StructuredCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
