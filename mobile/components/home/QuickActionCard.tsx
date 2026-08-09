import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInRight } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type QuickActionCardProps = {
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
  delay?: number;
  tint?: string;
};

export function QuickActionCard({
  label,
  hint,
  icon,
  onPress,
  delay = 0,
  tint = colors.secondary,
}: QuickActionCardProps) {
  return (
    <Animated.View
      entering={FadeInRight.delay(delay).duration(420)}
      className="flex-1"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="min-h-[128px] justify-between rounded-3xl bg-white p-4 active:opacity-90"
        style={styles.card}
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: tint }}
        >
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <View>
          <AppText variant="body" className="font-bengali-bold text-primary">
            {label}
          </AppText>
          <AppText variant="caption" className="mt-1">
            {hint}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#064E3B",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
