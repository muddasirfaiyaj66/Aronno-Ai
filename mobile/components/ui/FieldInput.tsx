import { TextInput, View, type TextInputProps } from "react-native";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type FieldInputProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function FieldInput({
  label,
  hint,
  className = "",
  ...props
}: FieldInputProps) {
  return (
    <View className="gap-2">
      <AppText variant="body" className="font-bengali-bold text-ink">
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        className={`min-h-touch-lg rounded-2xl border border-neutral-200 bg-white px-4 font-bengali-medium text-body-lg text-ink ${className}`}
        {...props}
      />
      {hint ? (
        <AppText variant="caption" className="text-muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
