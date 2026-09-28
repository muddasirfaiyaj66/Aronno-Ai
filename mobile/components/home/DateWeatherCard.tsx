import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
import { colors } from "@/constants/theme";
import { WeatherMood } from "@/components/home/WeatherMood";
import { useLocale } from "@/context/locale";
import { formatHomeDate, formatHomeTime, toLocaleDigits } from "@/utils/datetime";
import type { CurrentWeather } from "@/types/weather";
import type { FarmLocationStatus } from "@/hooks/useFarmLocation";

const SKY: Record<CurrentWeather["kind"], [string, string, string]> = {
  sunny: ["#E7F5F2", "#FFFFFF", "#F4F7F6"],
  partly: ["#E7F5F2", "#FFFFFF", "#D5F3EC"],
  cloudy: ["#EEF2F1", "#FFFFFF", "#E7EEEB"],
  rainy: ["#E7F5F2", "#FFFFFF", "#C5E4DB"],
  storm: ["#D5F3EC", "#FFFFFF", "#C5E4DB"],
};

export function DateWeatherCard({
  weather,
  locationStatus,
  locationLabel,
  onEnableLocation,
}: {
  weather?: CurrentWeather | null;
  locationStatus?: FarmLocationStatus;
  locationLabel?: string | null;
  onEnableLocation?: () => void;
}) {
  const { t, locale } = useLocale();
  const [now, setNow] = useState(() => new Date());
  const kind = weather?.kind ?? "partly";
  const needsPermission = locationStatus === "denied" || locationStatus === "off";
  const place = weather?.locationBn || locationLabel;
  const float = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    shine.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [float, shine]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, -10]) },
      { translateX: interpolate(float.value, [0, 1], [0, 8]) },
      { scale: interpolate(float.value, [0, 1], [1, 1.08]) },
    ],
  }));

  const icon3d = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateY: `${interpolate(float.value, [0, 1], [-10, 10])}deg` },
      { translateY: interpolate(float.value, [0, 1], [0, -4]) },
    ],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    opacity: 0.18,
    transform: [{ translateX: interpolate(shine.value, [0, 1], [-160, 320]) }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(60).duration(480).springify()}>
      <View style={styles.shadow}>
        <LinearGradient
          colors={SKY[kind]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.orb, orbStyle]}
          />
          <Animated.View pointerEvents="none" style={[styles.shine, shineStyle]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.85)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <AppText variant="caption" className="font-bengali-semibold text-primary">
                {t("আজকের আবহাওয়া", "Today's weather")}
              </AppText>
              <AppText variant="title" className="mt-1 text-primary">
                {formatHomeDate(now, locale)}
              </AppText>
              <View className="mt-3 flex-row items-center gap-2">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(6,78,59,0.1)" }}
                >
                  <Ionicons name="time-outline" size={16} color={colors.forest900} />
                </View>
                <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                  {formatHomeTime(now, locale)}
                </AppText>
              </View>
            </View>

            <Animated.View style={icon3d} className="items-center">
              <WeatherMood kind={kind} size={36} />
              {weather ? (
                <AppText
                  variant="display"
                  className="mt-1 text-primary"
                  style={{ fontSize: 36, lineHeight: 42 }}
                >
                  {toLocaleDigits(weather.tempC, locale)}°
                </AppText>
              ) : (
                <AppText variant="caption" className="mt-1">
                  {t("আনা হচ্ছে…", "Loading…")}
                </AppText>
              )}
            </Animated.View>
          </View>

          {weather ? (
            <View className="mt-4 rounded-2xl bg-white/80 px-3 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <AppText variant="body" className="font-bengali-semibold text-ink">
                    {t(weather.conditionBn, weather.conditionEn)}
                  </AppText>
                  <AppText variant="caption" className="mt-0.5">
                    {place}
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
          ) : null}

          {needsPermission && onEnableLocation ? (
            <Pressable
              onPress={onEnableLocation}
              accessibilityRole="button"
              accessibilityLabel={t("অবস্থান চালু করুন", "Turn on location")}
              className="mt-3 flex-row items-center gap-2 rounded-2xl bg-white/90 px-3 py-3"
            >
              <Ionicons name="location-outline" size={18} color={colors.forest900} />
              <AppText variant="caption" className="flex-1 font-bengali-semibold text-primary">
                {locationStatus === "off"
                  ? t(
                      "ফোনের লোকেশন চালু করুন — আপনার এলাকার আবহাওয়া দেখুন",
                      "Turn on phone location for local weather",
                    )
                  : t(
                      "অবস্থানের অনুমতি দিন — আপনার ক্ষেতের আবহাওয়া দেখুন",
                      "Allow location for field weather",
                    )}
              </AppText>
            </Pressable>
          ) : null}
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 28,
    shadowColor: colors.forest900,
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
    borderColor: "rgba(213,221,216,0.95)",
  },
  orb: {
    position: "absolute",
    right: -20,
    top: -24,
    height: 110,
    width: 110,
    borderRadius: 55,
    backgroundColor: "rgba(47,125,98,0.12)",
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 70,
  },
});
