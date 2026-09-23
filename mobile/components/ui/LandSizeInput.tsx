import { TextInput, View } from "react-native";
import { AppText } from "./AppText";
import { SegmentedTabs } from "./SegmentedTabs";
import { colors } from "@/constants/theme";
import type { LandUnit } from "@/types/treatment";

const UNIT_OPTIONS: { id: LandUnit; label: string }[] = [
  { id: "bigha", label: "বিঘা" },
  { id: "acre", label: "একর" },
];

export type LandSizeInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  unit: LandUnit;
  onUnitChange: (unit: LandUnit) => void;
  label?: string;
};

/** Land size with a বিঘা / একর toggle. Accepts Bangla or English digits. */
export function LandSizeInput({
  value,
  onChangeText,
  unit,
  onUnitChange,
  label = "জমির পরিমাণ",
}: LandSizeInputProps) {
  return (
    <View className="gap-3">
      <AppText variant="body" className="font-bengali-bold text-ink">
        {label}
      </AppText>
      <View className="flex-row items-center gap-3">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="যেমনঃ ২"
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          className="min-h-touch-lg flex-1 rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
        />
        <SegmentedTabs options={UNIT_OPTIONS} value={unit} onChange={onUnitChange} />
      </View>
    </View>
  );
}
