import type { ComponentProps } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type ForecastMonthEntry = {
  id: string;
  monthLabel: string;
  weatherIcon: IconName;
  tempC?: number;
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
    <View
      className={`overflow-hidden rounded-3xl bg-white ${className}`}
      style={styles.card}
    >
      <View className="px-5 pt-5">
        <AppText variant="bodyLg" className="font-bengali-bold text-primary">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" className="mt-1">
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={months}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => (
          <View className="w-24 items-center rounded-2xl bg-neutral px-3 py-4">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              {item.monthLabel}
            </AppText>
            <View className="my-2 h-10 w-10 items-center justify-center rounded-full bg-white">
              <Ionicons name={item.weatherIcon} size={20} color={colors.primary} />
            </View>
            {item.tempC != null ? (
              <AppText variant="caption" className="mb-1 text-muted">
                {item.tempC}°
              </AppText>
            ) : null}
            <View className="rounded-full bg-secondary px-2.5 py-1">
              <AppText
                variant="caption"
                numberOfLines={1}
                className="font-bengali-semibold text-primary"
              >
                {item.cropLabel}
              </AppText>
            </View>
          </View>
        )}
      />
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
  row: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
