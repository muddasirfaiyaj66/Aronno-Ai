import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type BentoTileProps = {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  locked?: boolean;
  lockedLabel?: string;
  size?: "md" | "lg";
  tint?: string;
  delay?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function BentoTile({
  icon,
  label,
  subtitle,
  onPress,
  locked = false,
  lockedLabel = "শীঘ্রই আসছে",
  size = "md",
  tint,
  delay = 0,
  className = "",
  style,
}: BentoTileProps) {
  const scale = useSharedValue(1);
  const accent = tint ?? colors.secondary;
  const isLg = size === "lg";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(480).springify().damping(15)}
      className={className}
      style={style}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 16, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        }}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
        accessibilityState={{ disabled: locked }}
      >
        <Animated.View
          style={[
            styles.tile,
            { backgroundColor: colors.card, borderColor: colors.border },
            isLg && styles.tileLg,
            animatedStyle,
          ]}
        >
          {locked ? (
            <View className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full bg-neutral-200 px-2 py-1">
              <Ionicons name="lock-closed" size={12} color={colors.muted} />
              <AppText
                variant="caption"
                className="font-bengali-semibold text-muted"
              >
                {lockedLabel}
              </AppText>
            </View>
          ) : null}

          <View
            className="items-center justify-center rounded-2xl"
            style={{
              backgroundColor: locked ? colors.neutral : accent,
              height: isLg ? 56 : 48,
              width: isLg ? 56 : 48,
            }}
          >
            <Ionicons
              name={icon}
              size={isLg ? 28 : 24}
              color={locked ? colors.muted : colors.primary}
            />
          </View>

          <AppText
            variant={isLg ? "bodyLg" : "body"}
            numberOfLines={2}
            className={`mt-3 text-center font-bengali-bold ${
              locked ? "text-muted" : "text-ink"
            }`}
          >
            {label}
          </AppText>

          {subtitle ? (
            <AppText
              variant="caption"
              numberOfLines={2}
              className="mt-1 text-center leading-5"
            >
              {subtitle}
            </AppText>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.8)",
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    minHeight: 128,
    shadowColor: "#064E3B",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  tileLg: {
    minHeight: 108,
    paddingVertical: 20,
  },
});
