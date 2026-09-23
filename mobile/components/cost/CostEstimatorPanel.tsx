import { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AIGeneratingShimmer,
  AppText,
  IconPickerRow,
  LandSizeInput,
  PrimaryButton,
  RetryCard,
} from "@/components/ui";
import { CultivationCostCard } from "@/components/cost/CultivationCostCard";
import { colors } from "@/constants/theme";
import { CROP_OPTIONS, cropLabel } from "@/constants/crops";
import { useCreateCostEstimateMutation } from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { parseNumberInput } from "@/utils/number";
import type { CostEstimateResult, CropType, LandUnit } from "@/types/treatment";

export type CostEstimatorPanelProps = {
  /** Limit the crop chips (e.g. to a plan's priority crops). */
  crops?: CropType[];
  initialCrop?: CropType | null;
  /** Hide the pesticide / spray row (shown in the stand-alone estimator). */
  showSpray?: boolean;
};

/**
 * Crop + land size → cultivation cost via `/cost-estimates`. Shared by the
 * cost estimator screen and the crop plan so both use the same numbers.
 */
export function CostEstimatorPanel({
  crops,
  initialCrop = null,
  showSpray = true,
}: CostEstimatorPanelProps) {
  const [cropType, setCropType] = useState<CropType | null>(initialCrop);
  const [landSize, setLandSize] = useState("");
  const [landUnit, setLandUnit] = useState<LandUnit>("bigha");
  const [result, setResult] = useState<CostEstimateResult | null>(null);
  const [createEstimate, { isLoading }] = useCreateCostEstimateMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialCrop) setCropType(initialCrop);
  }, [initialCrop]);

  const options = crops?.length
    ? CROP_OPTIONS.filter((c) => crops.includes(c.id))
    : CROP_OPTIONS;
  const parsedLandSize = parseNumberInput(landSize);
  const canSubmit = !!cropType && parsedLandSize > 0;

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
    <View className="gap-6">
      <View className="gap-3">
        <AppText variant="body" className="font-bengali-bold text-ink">
          ফসলের ধরন
        </AppText>
        <IconPickerRow
          options={options.map((c) => ({
            id: c.id,
            label: c.label,
            icon: <Ionicons name={c.icon} size={22} color={colors.primary} />,
          }))}
          value={cropType}
          onChange={(id) => {
            setCropType(id as CropType);
            setResult(null);
          }}
        />
      </View>

      <LandSizeInput
        value={landSize}
        onChangeText={setLandSize}
        unit={landUnit}
        onUnitChange={setLandUnit}
      />

      <PrimaryButton
        label="হিসাব করুন"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={isLoading}
        icon={<Ionicons name="calculator-outline" size={20} color={colors.white} />}
      />

      {errorMessage ? <RetryCard message={errorMessage} onRetry={handleSubmit} /> : null}

      {isLoading ? (
        <AIGeneratingShimmer label="খরচ হিসাব হচ্ছে" lines={3} className="w-full" />
      ) : null}

      {result?.cultivation ? (
        <CultivationCostCard
          cost={result.cultivation}
          caption={`${cropLabel(cropType)} · ${landSize} ${landUnit === "bigha" ? "বিঘা" : "একর"}`}
          spray={showSpray ? result : undefined}
        />
      ) : null}
    </View>
  );
}
