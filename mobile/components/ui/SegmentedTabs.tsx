import { Pressable, ScrollView } from "react-native";
import { AppText } from "./AppText";

export type SegmentedTabOption<T extends string> = {
  id: T;
  label: string;
};

export type SegmentedTabsProps<T extends string> = {
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName={`gap-1.5 rounded-full bg-neutral-100 p-1.5 ${className}`}
    >
      {options.map((option) => {
        const selected = option.id === value;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            className={`min-h-touch items-center justify-center rounded-full px-4 ${
              selected ? "bg-primary" : "bg-transparent"
            }`}
          >
            <AppText
              variant="body"
              numberOfLines={1}
              className={`font-bengali-bold ${
                selected ? "text-white" : "text-muted"
              }`}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
