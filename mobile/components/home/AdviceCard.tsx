import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import {
  AppText,
  ListenButton,
  SecondaryButton,
  SeverityBadge,
  type SeverityLevel,
} from "@/components/ui";
import { colors } from "@/constants/theme";

export type AdviceCardProps = {
  title: string;
  headline: string;
  body: string;
  severity: SeverityLevel;
  detailsLabel: string;
  delay?: number;
  onDetails?: () => void;
};

export function AdviceCard({
  title,
  headline,
  body,
  severity,
  detailsLabel,
  delay = 0,
  onDetails,
}: AdviceCardProps) {
  const reveal = useSharedValue(0.92);

  useEffect(() => {
    reveal.value = withDelay(
      delay + 80,
      withSpring(1, { damping: 14, stiffness: 120 }),
    );
  }, [delay, reveal]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reveal.value }],
    opacity: reveal.value,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(520).springify()}>
      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient
          colors={["#ECFDF5", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inner}
        >
          <View className="h-1.5 w-full bg-tertiary" />

          <View className="flex-row items-center gap-3 px-5 pb-2 pt-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <Ionicons name="leaf" size={22} color={colors.primary} />
            </View>
            <AppText
              variant="bodyLg"
              className="flex-1 font-bengali-bold text-primary"
            >
              {title}
            </AppText>
          </View>

          <View className="px-5 py-4">
            <SeverityBadge level={severity} className="mb-3" />
            <AppText variant="bodyLg" className="mb-2 font-bengali-bold">
              {headline}
            </AppText>
            <AppText variant="body" className="leading-7 text-muted">
              {body}
            </AppText>
          </View>

          <View className="flex-row gap-3 px-5 pb-5 pt-1">
            <Animated.View
              entering={FadeInRight.delay(delay + 120).duration(360)}
              className="flex-1"
            >
              <ListenButton
                onPlay={() => {}}
                onPause={() => {}}
                className="bg-white"
              />
            </Animated.View>
            <Animated.View
              entering={FadeInRight.delay(delay + 180).duration(360)}
              className="flex-1"
            >
              <SecondaryButton
                label={detailsLabel}
                onPress={onDetails}
                className="bg-white"
              />
            </Animated.View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#064E3B",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  inner: {
    borderRadius: 28,
    overflow: "hidden",
  },
});
