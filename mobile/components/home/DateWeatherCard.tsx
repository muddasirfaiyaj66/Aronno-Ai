import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { useLocale } from "@/context/locale";
import {
  formatHomeDate,
  formatHomeTime,
  MOCK_WEATHER,
  toLocaleDigits,
} from "@/utils/datetime";

const WEATHER_ICON: Record<
  typeof MOCK_WEATHER.icon,
  keyof typeof Ionicons.glyphMap
> = {
  sunny: "sunny",
  partly: "partly-sunny",
  rainy: "rainy",
  cloudy: "cloudy",
};

export function DateWeatherCard() {
  const { t, locale } = useLocale();
  const [now, setNow] = useState(() => new Date());
  const drift = useSharedValue(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const sunStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [0, -6]) },
      { scale: interpolate(drift.value, [0, 1], [1, 1.05]) },
    ],
  }));

  const weather = MOCK_WEATHER;

  return (
    <Animated.View entering={FadeInDown.delay(60).duration(480).springify()}>
      <View style={styles.shadow}>
        <LinearGradient
          colors={["#ECFDF5", "#FFFFFF", "#D1FAE5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <AppText variant="caption" className="font-bengali-semibold text-primary">
                {t("আজকের দিন", "Today")}
              </AppText>
              <AppText variant="title" className="mt-1 text-primary">
                {formatHomeDate(now, locale)}
              </AppText>
              <View className="mt-3 flex-row items-center gap-2">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(6,78,59,0.1)" }}
                >
                  <Ionicons name="time-outline" size={16} color="#064E3B" />
                </View>
                <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                  {formatHomeTime(now, locale)}
                </AppText>
              </View>
            </View>

            <Animated.View style={sunStyle} className="items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Ionicons
                  name={WEATHER_ICON[weather.icon]}
                  size={34}
                  color="#047857"
                />
              </View>
              <AppText
                variant="display"
                className="mt-1 text-primary"
                style={{ fontSize: 36, lineHeight: 42 }}
              >
                {toLocaleDigits(weather.tempC, locale)}°
              </AppText>
            </Animated.View>
          </View>

          <View className="mt-4 rounded-2xl bg-white/80 px-3 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <AppText variant="body" className="font-bengali-semibold text-ink">
                  {t(weather.conditionBn, weather.conditionEn)}
                </AppText>
                <AppText variant="caption" className="mt-0.5">
                  {t(weather.locationBn, weather.locationEn)}
                </AppText>
              </View>

              <View className="flex-row gap-4">
                <View className="items-center">
                  <Ionicons name="water-outline" size={16} color="#6B7280" />
                  <AppText variant="caption" className="mt-1 font-bengali-bold text-ink">
                    {toLocaleDigits(weather.humidity, locale)}%
                  </AppText>
                </View>
                <View className="items-center">
                  <Ionicons name="navigate-outline" size={16} color="#6B7280" />
                  <AppText variant="caption" className="mt-1 font-bengali-bold text-ink">
                    {toLocaleDigits(weather.windKph, locale)} {t("কিমি", "km")}
                  </AppText>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 28,
    shadowColor: "#064E3B",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(209,250,229,0.9)",
  },
});
