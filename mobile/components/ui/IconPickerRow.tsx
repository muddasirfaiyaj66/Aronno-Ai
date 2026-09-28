import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "./AppText";

export type IconPickerOption = {
  id: string;
  label: string;
  icon: ReactNode;
};

export type IconPickerRowProps = {
  options: IconPickerOption[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
};

export function IconPickerRow({
  options,
  value,
  onChange,
  className = "",
}: IconPickerRowProps) {
  return (
    <View className={`flex-row flex-wrap gap-3 ${className}`}>
      {options.map((option) => {
        const selected = option.id === value;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            className={`min-h-touch w-[47%] items-center gap-2 rounded-2xl border px-3 py-3.5 ${
              selected
                ? "border-primary bg-secondary"
                : "border-border bg-neutral"
            }`}
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-card">
              {option.icon}
            </View>
            <AppText
              variant="caption"
              className={`text-center font-bengali-bold ${
                selected ? "text-primary" : "text-ink"
              }`}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
