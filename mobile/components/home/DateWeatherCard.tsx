import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { WeatherMood } from "@/components/home/WeatherMood";
import { useLocale } from "@/context/locale";
import { formatHomeDate, formatHomeTime, toLocaleDigits } from "@/utils/datetime";
import type { CurrentWeather } from "@/types/weather";
import type { FarmLocationStatus } from "@/hooks/useFarmLocation";

const SKY: Record<CurrentWeather["kind"], [string, string, string]> = {
  sunny: ["#E8F2EE", "#FFFFFF", "#F4F6F4"],
  partly: ["#E8F2EE", "#FFFFFF", "#D4E8E0"],
  cloudy: ["#EEF1EF", "#FFFFFF", "#E8ECE9"],
  rainy: ["#E4EFE9", "#FFFFFF", "#C5DCD0"],
  storm: ["#D4E8E0", "#FFFFFF", "#C5DCD0"],
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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.View entering={FadeInDown.delay(60).duration(480).springify()}>
      <View style={styles.shadow}>
        <LinearGradient
          colors={SKY[kind]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
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

            <View className="items-center">
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
            </View>
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
});
