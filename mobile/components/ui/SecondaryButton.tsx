import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";
import { colors } from "@/constants/theme";
import { AppText } from "./AppText";

export type SecondaryButtonProps = PressableProps & {
  label: string;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
};

export function SecondaryButton({
  label,
  icon,
  loading = false,
  disabled,
  className = "",
  ...props
}: SecondaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      className={`min-h-touch-lg flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-white px-5 active:bg-neutral ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        icon
      )}
      <AppText
        variant="bodyLg"
        numberOfLines={1}
        className="shrink font-bengali-bold text-primary"
      >
        {label}
      </AppText>
    </Pressable>
  );
}
