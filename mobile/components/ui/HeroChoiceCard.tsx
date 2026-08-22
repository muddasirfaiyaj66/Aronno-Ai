import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type HeroChoiceCardProps = {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  tone?: "photo" | "voice" | "text";
};

const TONE = {
  photo: { bg: colors.harvestSoft, icon: colors.harvest },
  voice: { bg: colors.secondary, icon: colors.primary },
  text: { bg: "#EEF2FF", icon: "#4338CA" },
} as const;

export function HeroChoiceCard({
  title,
  subtitle,
  icon,
  onPress,
  tone = "voice",
}: HeroChoiceCardProps) {
  const palette = TONE[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className="min-h-[92px] flex-row items-center gap-4 rounded-[28px] border border-neutral-200 bg-white px-4 py-4 active:opacity-90"
      style={{
        shadowColor: colors.primary,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <View
        className="h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: palette.bg }}
      >
        <Ionicons name={icon} size={32} color={palette.icon} />
      </View>
      <View className="flex-1">
        <AppText variant="bodyLg" className="font-bengali-bold text-ink">
          {title}
        </AppText>
        <AppText variant="caption" className="mt-1 leading-6">
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.muted} />
    </Pressable>
  );
}
