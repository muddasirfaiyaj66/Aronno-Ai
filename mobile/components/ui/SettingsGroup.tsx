import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText } from "./AppText";

export type SettingsGroupProps = {
  title?: string;
  footer?: string;
  children: ReactNode;
  className?: string;
};

/** Inset grouped list — iOS/Android settings style. */
export function SettingsGroup({
  title,
  footer,
  children,
  className = "",
}: SettingsGroupProps) {
  return (
    <View className={`gap-2 ${className}`}>
      {title ? (
        <AppText
          variant="caption"
          className="px-1 font-bengali-semibold text-muted"
        >
          {title}
        </AppText>
      ) : null}
      <View className="overflow-hidden rounded-2xl border border-border bg-white">
        {children}
      </View>
      {footer ? (
        <AppText variant="caption" className="px-1 leading-5">
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}
