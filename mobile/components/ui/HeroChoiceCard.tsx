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
import { useTheme } from "@/context/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type HeroChoiceCardProps = {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  tone?: "photo" | "voice" | "text";
};

export function HeroChoiceCard({
  title,
  subtitle,
  icon,
  onPress,
  tone = "voice",
}: HeroChoiceCardProps) {
  const { scheme } = useTheme();
  const dark = scheme === "dark";
  const palette =
    tone === "photo"
      ? {
          bg: "rgba(255,255,255,0.18)",
          icon: colors.white,
          gradient: ["#1AA88A", "#0F766E", "#115E59"] as const,
          light: false,
        }
      : tone === "voice"
        ? {
            bg: dark ? "#3A2E18" : "#FBF4E6",
            icon: dark ? "#E8B04A" : "#C4841D",
            gradient: [colors.card, colors.card] as const,
            light: true,
          }
        : {
            bg: dark ? "#1C2C40" : "#E7F1FB",
            icon: dark ? "#93C5FD" : "#1D4E89",
            gradient: [colors.card, colors.card] as const,
            light: true,
          };
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
        minHeight: 96,
        borderRadius: 28,
        backgroundColor: colors.card,
        borderWidth: palette.light ? 1 : 0,
        borderColor: colors.border,
        overflow: "hidden",
        shadowColor: palette.light ? "#115E59" : colors.primary,
        shadowOpacity: palette.light ? 0.08 : 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
      }}
    >
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ minHeight: 96 }}
      >
      <View className="min-h-[96px] flex-row items-center gap-4 px-4 py-4">
        <Animated.View
          pointerEvents="none"
          style={[
            iconStyle,
            {
              height: 64,
              width: 64,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.light ? palette.bg : "rgba(255,255,255,0.18)",
            },
          ]}
        >
          <Ionicons name={icon} size={30} color={palette.icon} />
        </Animated.View>
        <View className="flex-1" pointerEvents="none">
          <AppText
            variant="bodyLg"
            className="font-bengali-bold"
            style={{ color: palette.light ? colors.ink : colors.white }}
          >
            {title}
          </AppText>
          <AppText
            variant="caption"
            className="mt-1 leading-6"
            style={{ color: palette.light ? colors.muted : "rgba(255,255,255,0.86)" }}
          >
            {subtitle}
          </AppText>
        </View>
        <Ionicons
          name="arrow-forward"
          size={18}
          color={palette.light ? colors.primary : colors.white}
        />
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, width: 70 }, shineStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.7)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
      </LinearGradient>
    </TiltPressable>
  );
}
