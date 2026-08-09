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
    <View className={`flex-row gap-3 ${className}`}>
      {options.map((option) => {
        const selected = option.id === value;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            className={`min-h-touch flex-1 items-center gap-2 rounded-3xl px-3 py-4 ${
              selected ? "bg-secondary" : "bg-white"
            }`}
          >
            <View
              className={`h-11 w-11 items-center justify-center rounded-2xl ${
                selected ? "bg-white" : "bg-neutral"
              }`}
            >
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
