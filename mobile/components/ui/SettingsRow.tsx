import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type SettingsRowProps = {
  label: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  loading?: boolean;
  right?: ReactNode;
  /** Hide bottom hairline (last row in a group). */
  last?: boolean;
};

export function SettingsRow({
  label,
  subtitle,
  value,
  icon,
  iconColor = colors.primary,
  iconBg = colors.secondary,
  onPress,
  destructive = false,
  showChevron = true,
  loading = false,
  right,
  last = false,
}: SettingsRowProps) {
  const content = (
    <View
      className={`min-h-[56px] flex-row items-center gap-3 px-4 py-3 ${
        last ? "" : "border-b border-border"
      }`}
    >
      {icon ? (
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: destructive ? "#FEE4E2" : iconBg }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? "#B42318" : iconColor}
          />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <AppText
          variant="body"
          className={`font-bengali-semibold ${
            destructive ? "text-severity-high" : "text-ink"
          }`}
          numberOfLines={1}
        >
          {label}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" className="mt-0.5" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : right ? (
        right
      ) : (
        <>
          {value ? (
            <AppText
              variant="caption"
              className="max-w-[42%] text-right font-bengali-medium"
              numberOfLines={1}
            >
              {value}
            </AppText>
          ) : null}
          {onPress && showChevron && !destructive ? (
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          ) : null}
        </>
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:bg-neutral/80"
    >
      {content}
    </Pressable>
  );
}
