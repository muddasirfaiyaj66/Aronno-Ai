import type { ComponentProps } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import type { SprayAdvisoryLevel } from "@/types/treatment";

type IconName = ComponentProps<typeof Ionicons>["name"];

const ADVISORY_STYLES: Record<
  SprayAdvisoryLevel,
  { bg: string; text: string; icon: IconName; color: string; label: string }
> = {
  safe: {
    bg: "bg-severity-low-bg",
    text: "text-severity-low",
    icon: "checkmark-circle",
    color: "#047857",
    label: "স্প্রে করা নিরাপদ",
  },
  caution: {
    bg: "bg-severity-medium-bg",
    text: "text-severity-medium",
    icon: "alert-circle",
    color: "#B54708",
    label: "সতর্কতার সাথে স্প্রে করুন",
  },
  wait: {
    bg: "bg-severity-high-bg",
    text: "text-severity-high",
    icon: "close-circle",
    color: "#B42318",
    label: "অপেক্ষা করুন",
  },
};

export type WeatherAdvisoryCardProps = {
  level: SprayAdvisoryLevel;
  reasonBn: string;
  className?: string;
};

export function WeatherAdvisoryCard({
  level,
  reasonBn,
  className = "",
}: WeatherAdvisoryCardProps) {
  const style = ADVISORY_STYLES[level];

  return (
    <View
      className={`flex-row items-center gap-3 rounded-3xl px-5 py-4 ${style.bg} ${className}`}
    >
      <Ionicons name={style.icon} size={26} color={style.color} />
      <View className="flex-1">
        <AppText variant="bodyLg" className={`font-bengali-bold ${style.text}`}>
          {style.label}
        </AppText>
        <AppText variant="body" className="mt-1 text-ink">
          {reasonBn}
        </AppText>
      </View>
    </View>
  );
}
