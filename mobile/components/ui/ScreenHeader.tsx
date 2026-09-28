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
    <View className="border-b border-border bg-card px-5 pb-3.5 pt-2">
      <View className="flex-row items-center gap-3">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="ফিরে যান"
            className="h-11 w-11 items-center justify-center rounded-full bg-neutral"
            hitSlop={6}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
        <View className="min-w-0 flex-1">
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" className="mt-0.5 leading-5" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}
