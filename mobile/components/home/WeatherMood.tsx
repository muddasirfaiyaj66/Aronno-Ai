import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { WeatherKind } from "@/types/weather";
import { colors } from "@/constants/theme";

const KIND_ICON: Record<WeatherKind, keyof typeof Ionicons.glyphMap> = {
  sunny: "sunny",
  partly: "partly-sunny",
  cloudy: "cloudy",
  rainy: "rainy",
  storm: "thunderstorm",
};

const KIND_COLOR: Record<WeatherKind, string> = {
  sunny: colors.harvest,
  partly: colors.primary,
  cloudy: colors.muted,
  rainy: colors.tertiary,
  storm: colors.forest900,
};

export function WeatherMood({
  kind,
  size = 34,
}: {
  kind: WeatherKind;
  size?: number;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: kind === "storm" ? 700 : 2200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [kind, pulse]);

  const iconStyle = useAnimatedStyle(() => {
    if (kind === "sunny" || kind === "partly") {
      return {
        transform: [
          { rotate: `${interpolate(pulse.value, [0, 1], [0, 12])}deg` },
          { scale: interpolate(pulse.value, [0, 1], [1, 1.08]) },
        ],
      };
    }
    if (kind === "cloudy") {
      return {
        transform: [{ translateX: interpolate(pulse.value, [0, 1], [-4, 4]) }],
      };
    }
    return {
      transform: [{ translateY: interpolate(pulse.value, [0, 1], [0, 3]) }],
    };
  });

  return (
    <View
      style={{
        width: size + 18,
        height: size + 18,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {(kind === "rainy" || kind === "storm") &&
        [0, 1, 2].map((i) => <RainDrop key={i} delay={i * 180} left={8 + i * 12} />)}
      <Animated.View style={iconStyle}>
        <Ionicons name={KIND_ICON[kind]} size={size} color={KIND_COLOR[kind]} />
      </Animated.View>
    </View>
  );
}

function RainDrop({ delay, left }: { delay: number; left: number }) {
  const fall = useSharedValue(0);

  useEffect(() => {
    fall.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }), -1, false),
    );
  }, [delay, fall]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(fall.value, [0, 0.2, 1], [0, 0.9, 0]),
    transform: [{ translateY: interpolate(fall.value, [0, 1], [0, 16]) }],
  }));
  return <Animated.View style={[styles.drop, { left }, style]} />;
}

const styles = StyleSheet.create({
  drop: {
    position: "absolute",
    top: 2,
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: colors.tertiary,
  },
});
