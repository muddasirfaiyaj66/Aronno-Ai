import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

export type PriceHeroCardProps = {
  title: string;
  price: string;
  unit: string;
  delta: string;
  meta: string;
  onPress?: () => void;
};

export function PriceHeroCard({
  title,
  price,
  unit,
  delta,
  meta,
  onPress,
}: PriceHeroCardProps) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const shine = useSharedValue(-1);
  const numberScale = useSharedValue(0.86);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    shine.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    numberScale.value = withDelay(
      180,
      withSpring(1, { damping: 12, stiffness: 140 }),
    );
  }, [float, numberScale, pulse, shine]);

  const orbAStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, -10]) },
      { translateX: interpolate(float.value, [0, 1], [0, 6]) },
      { scale: interpolate(float.value, [0, 1], [1, 1.06]) },
    ],
  }));

  const orbBStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, 12]) },
      { translateX: interpolate(float.value, [0, 1], [0, -8]) },
    ],
    opacity: interpolate(float.value, [0, 1], [0.35, 0.55]),
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shine.value, [0, 1], [-220, 340]),
      },
      { rotate: "-18deg" },
    ],
  }));

  const priceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numberScale.value }],
    opacity: numberScale.value,
  }));

  return (
    <Animated.View entering={FadeInDown.duration(560).springify().damping(16)}>
      <Pressable onPress={onPress} accessibilityRole="button">
        <View style={styles.shadow}>
          <LinearGradient
            colors={["#064E3B", "#047857", "#10B981"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Animated.View style={[styles.orbA, orbAStyle]} />
            <Animated.View style={[styles.orbB, orbBStyle]} />
            <Animated.View style={[styles.shine, shineStyle]} />

            <View className="relative z-10">
              <View className="mb-5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Ionicons name="trending-up" size={18} color="#ECFDF5" />
                  </View>
                  <AppText
                    variant="caption"
                    className="font-bengali-semibold"
                    style={{ color: "#D1FAE5" }}
                  >
                    {title}
                  </AppText>
                </View>

                <Animated.View
                  style={badgeStyle}
                  className="flex-row items-center gap-1 rounded-full bg-white/95 px-2.5 py-1"
                >
                  <Ionicons name="arrow-up" size={12} color={colors.primary} />
                  <AppText
                    variant="caption"
                    className="font-bengali-bold text-primary"
                  >
                    {delta}
                  </AppText>
                </Animated.View>
              </View>

              <Animated.View style={priceStyle}>
                <View className="flex-row items-end gap-2">
                  <AppText
                    variant="hero"
                    className="text-white"
                    style={{ color: "#FFFFFF" }}
                  >
                    {price}
                  </AppText>
                  <AppText
                    variant="bodyLg"
                    className="mb-2 font-bengali-medium"
                    style={{ color: "#D1FAE5" }}
                  >
                    {unit}
                  </AppText>
                </View>
              </Animated.View>

              <View className="mt-4 flex-row items-center justify-between">
                <AppText
                  variant="caption"
                  style={{ color: "#A7F3D0" }}
                >
                  {meta}
                </AppText>
                <View className="h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#ECFDF5"
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 28,
    shadowColor: "#064E3B",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: "hidden",
    minHeight: 168,
  },
  orbA: {
    position: "absolute",
    right: -30,
    top: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(209,250,229,0.22)",
  },
  orbB: {
    position: "absolute",
    left: -40,
    bottom: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(16,185,129,0.35)",
  },
  shine: {
    position: "absolute",
    top: -40,
    width: 70,
    height: 240,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
