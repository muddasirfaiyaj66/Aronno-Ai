import { View } from "react-native";
import { AppText } from "./AppText";
import { useLocale } from "@/context/locale";

export type SeverityLevel = "low" | "medium" | "high";

const SEVERITY: Record<
  SeverityLevel,
  { bn: string; en: string; badge: string; text: string }
> = {
  low: {
    bn: "কম",
    en: "Low",
    badge: "bg-severity-low-bg",
    text: "text-severity-low",
  },
  medium: {
    bn: "মাঝারি",
    en: "Medium",
    badge: "bg-severity-medium-bg",
    text: "text-severity-medium",
  },
  high: {
    bn: "উচ্চ",
    en: "High",
    badge: "bg-severity-high-bg",
    text: "text-severity-high",
  },
};

export type SeverityBadgeProps = {
  level: SeverityLevel;
  className?: string;
};

export function SeverityBadge({ level, className = "" }: SeverityBadgeProps) {
  const { locale } = useLocale();
  const config = SEVERITY[level];
  const label = locale === "bn" ? config.bn : config.en;

  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 ${config.badge} ${className}`}
      accessibilityRole="text"
      accessibilityLabel={`${config.bn}, ${config.en}`}
    >
      <View
        className={`h-2 w-2 rounded-full ${
          level === "low"
            ? "bg-severity-low"
            : level === "medium"
              ? "bg-severity-medium"
              : "bg-severity-high"
        }`}
      />
      <AppText
        variant="caption"
        className={`font-bengali-semibold ${config.text}`}
      >
        {label}
      </AppText>
    </View>
  );
}
