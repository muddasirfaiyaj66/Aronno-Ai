import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { WeatherMood } from "@/components/home/WeatherMood";
import { useLocale } from "@/context/locale";
import { formatHomeDate, formatHomeTime, toLocaleDigits } from "@/utils/datetime";
import type { CurrentWeather } from "@/types/weather";

const SKY: Record<CurrentWeather["kind"], [string, string, string]> = {
  sunny: ["#FEF3C7", "#FFFFFF", "#FDE68A"],
  partly: ["#ECFDF5", "#FFFFFF", "#D1FAE5"],
  cloudy: ["#F3F4F6", "#FFFFFF", "#E5E7EB"],
  rainy: ["#DBEAFE", "#FFFFFF", "#BFDBFE"],
  storm: ["#E0E7FF", "#FFFFFF", "#C7D2FE"],
};

export function DateWeatherCard({ weather }: { weather?: CurrentWeather | null }) {
  const { t, locale } = useLocale();
  const [now, setNow] = useState(() => new Date());
  const kind = weather?.kind ?? "partly";

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
                  <Ionicons name="time-outline" size={16} color="#064E3B" />
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
                    {weather.locationBn}
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
