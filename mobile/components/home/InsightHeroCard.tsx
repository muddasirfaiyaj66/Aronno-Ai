import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type InsightKind = "weather" | "yield" | "loan";

export type InsightItem = {
  id: string;
  kind: InsightKind;
  icon: IconName;
  message: string;
  heroNumber?: string;
  heroUnit?: string;
};

export type InsightHeroCardProps = {
  insights: InsightItem[];
  onPress?: (item: InsightItem) => void;
  intervalMs?: number;
  className?: string;
};

export function InsightHeroCard({
  insights,
  onPress,
  intervalMs = 6000,
  className = "",
}: InsightHeroCardProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (insights.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % insights.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [insights.length, intervalMs]);

  const active = insights[index];
  if (!active) return null;

  return (
    <Animated.View entering={FadeIn.duration(420)} className={className}>
      <Pressable onPress={() => onPress?.(active)} accessibilityRole="button">
        <View style={styles.shadow}>
          <LinearGradient
            colors={["#ECFDF5", "#FFFFFF", "#D1FAE5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Animated.View
              key={active.id}
              entering={FadeIn.duration(320)}
              exiting={FadeOut.duration(220)}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                  <Ionicons name={active.icon} size={24} color={colors.primary} />
                </View>
                <AppText variant="bodyLg" className="flex-1 font-bengali-bold text-ink">
                  {active.message}
                </AppText>
              </View>

              {active.heroNumber ? (
                <View className="mt-4 flex-row items-end gap-2">
                  <AppText
                    variant="hero"
                    className="text-primary"
                    style={{ fontSize: 34, lineHeight: 40 }}
                  >
                    {active.heroNumber}
                  </AppText>
                  {active.heroUnit ? (
                    <AppText variant="bodyLg" className="mb-1.5 text-muted">
                      {active.heroUnit}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </Animated.View>

            {insights.length > 1 ? (
              <View className="mt-4 flex-row gap-1.5">
                {insights.map((item, i) => (
                  <View
                    key={item.id}
                    className={`h-1.5 flex-1 rounded-full ${
                      i === index ? "bg-primary" : "bg-primary/15"
                    }`}
                  />
                ))}
              </View>
            ) : null}
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
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(209,250,229,0.9)",
    minHeight: 128,
  },
});
