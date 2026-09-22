import type { ComponentProps } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { TiltPressable } from "./TiltPressable";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type HeroChoiceCardProps = {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  tone?: "photo" | "voice" | "text";
};

const TONE = {
  photo: { bg: colors.secondary, icon: colors.primary },
  voice: { bg: colors.secondary, icon: colors.tertiary },
  text: { bg: "#EEF2F0", icon: colors.ink },
} as const;

export function HeroChoiceCard({
  title,
  subtitle,
  icon,
  onPress,
  tone = "voice",
}: HeroChoiceCardProps) {
  const palette = TONE[tone];
  const float = useSharedValue(0);
  const shine = useSharedValue(-1);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    shine.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [float, shine]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { translateY: interpolate(float.value, [0, 1], [0, -5]) },
      { rotateY: `${interpolate(float.value, [0, 1], [-12, 12])}deg` },
      { scale: interpolate(float.value, [0, 1], [1, 1.06]) },
    ],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shine.value, [0, 1], [-140, 280]) }],
    opacity: 0.22,
  }));

  return (
    <TiltPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      contentStyle={{
        minHeight: 92,
        borderRadius: 28,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        shadowColor: colors.primary,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
      }}
    >
      <View className="min-h-[92px] flex-row items-center gap-4 px-4 py-4">
        {/* Decorative only — whole card is the single tap target */}
        <Animated.View
          pointerEvents="none"
          style={[
            iconStyle,
            {
              height: 64,
              width: 64,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.bg,
            },
          ]}
        >
          <Ionicons name={icon} size={32} color={palette.icon} />
        </Animated.View>
        <View className="flex-1" pointerEvents="none">
          <AppText variant="bodyLg" className="font-bengali-bold text-ink">
            {title}
          </AppText>
          <AppText variant="caption" className="mt-1 leading-6">
            {subtitle}
          </AppText>
        </View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, width: 70 }, shineStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.7)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </TiltPressable>
  );
}
