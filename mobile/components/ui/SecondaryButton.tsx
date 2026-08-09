import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";
import { AppText } from "./AppText";

export type SecondaryButtonProps = PressableProps & {
  label: string;
  icon?: ReactNode;
  className?: string;
};

export function SecondaryButton({
  label,
  icon,
  disabled,
  className = "",
  ...props
}: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      className={`min-h-touch-lg flex-row items-center justify-center gap-2 rounded-2xl bg-white px-5 active:bg-neutral-100 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
      {...props}
    >
      {icon}
      <AppText variant="bodyLg" className="font-bengali-bold text-primary">
        {label}
      </AppText>
    </Pressable>
  );
}
