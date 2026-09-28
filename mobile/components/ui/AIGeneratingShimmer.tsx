import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type AIGeneratingShimmerProps = {
  label?: string;
  lines?: number;
  className?: string;
};

function ShimmerBar({
  width,
  delay = 0,
}: {
  width: DimensionValue;
  delay?: number;
}) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.35, {
            duration: 650,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { width, height: 14, borderRadius: 7, backgroundColor: colors.secondary },
        style,
      ]}
    />
  );
}

export function AIGeneratingShimmer({
  label = "তৈরি হচ্ছে…",
  lines = 3,
  className = "",
}: AIGeneratingShimmerProps) {
  const sparkle = useSharedValue(1);

  useEffect(() => {
    sparkle.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 550, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 550, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [sparkle]);

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkle.value }],
  }));

  const widths: DimensionValue[] = ["92%", "76%", "58%"];

  return (
    <View className={`rounded-3xl bg-card px-5 py-5 ${className}`} style={styles.card}>
      <View className="flex-row items-center gap-2">
        <Animated.View style={sparkleStyle}>
          <Ionicons name="sparkles" size={18} color={colors.tertiary} />
        </Animated.View>
        <AppText variant="caption" className="font-bengali-semibold text-primary">
          {label}
        </AppText>
      </View>
      <View className="mt-4 gap-3">
        {Array.from({ length: lines }).map((_, index) => (
          <ShimmerBar
            key={index}
            width={widths[index % widths.length]}
            delay={index * 120}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#064E3B",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
});
