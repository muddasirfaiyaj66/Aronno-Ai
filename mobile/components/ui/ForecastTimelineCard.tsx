import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { WeatherMood } from "@/components/home/WeatherMood";
import { colors } from "@/constants/theme";
import { weatherKindFromIcon } from "@/types/weather";

export type ForecastMonthEntry = {
  id: string;
  monthLabel: string;
  weatherIcon: string;
  tempC?: number;
  precipMm?: number;
  cropLabel: string;
};

export type ForecastTimelineCardProps = {
  title: string;
  subtitle?: string;
  months: ForecastMonthEntry[];
  className?: string;
};

export function ForecastTimelineCard({
  title,
  subtitle,
  months,
  className = "",
}: ForecastTimelineCardProps) {
  return (
    <View className={`rounded-3xl border border-neutral-200 bg-white ${className}`}>
      <View className="px-5 pt-5">
        <AppText variant="bodyLg" className="font-bengali-bold text-primary">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" className="mt-1 leading-6">
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <View className="gap-3 px-4 py-4">
        {months.map((item) => (
          <View
            key={item.id}
            className="flex-row items-start gap-3 rounded-2xl bg-neutral px-3 py-3"
          >
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white">
              <WeatherMood kind={weatherKindFromIcon(String(item.weatherIcon))} size={22} />
            </View>
            <View className="min-w-0 flex-1">
              <AppText variant="body" className="font-bengali-bold text-ink">
                {item.monthLabel}
              </AppText>
              <AppText variant="bodyLg" className="mt-1 font-bengali-bold text-primary">
                {item.cropLabel}
              </AppText>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {item.tempC != null ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-white px-2.5 py-1">
                    <Ionicons name="thermometer-outline" size={14} color={colors.primary} />
                    <AppText variant="caption" className="font-bengali-semibold text-ink">
                      {item.tempC}°
                    </AppText>
                  </View>
                ) : null}
                {item.precipMm != null ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-white px-2.5 py-1">
                    <Ionicons name="water-outline" size={14} color={colors.primary} />
                    <AppText variant="caption" className="font-bengali-semibold text-ink">
                      {item.precipMm} মিমি
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
