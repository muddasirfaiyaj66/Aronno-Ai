import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export function ScreenHeader({ title, subtitle, onBack }: ScreenHeaderProps) {
  return (
    <View className="border-b border-neutral-200 bg-white px-5 pb-4 pt-3">
      <View className="flex-row items-start gap-3">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="ফিরে যান"
            className="mt-0.5 h-12 w-12 items-center justify-center rounded-full bg-neutral"
          >
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <AppText variant="title">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" className="mt-1 leading-6">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}
