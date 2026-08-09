import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText } from "./AppText";
import { PrimaryButton } from "./PrimaryButton";

export type EmptyStateProps = {
  icon: ReactNode;
  message: string;
  ctaLabel: string;
  onCta: () => void;
  className?: string;
};

export function EmptyState({
  icon,
  message,
  ctaLabel,
  onCta,
  className = "",
}: EmptyStateProps) {
  return (
    <View className={`items-center px-6 py-10 ${className}`}>
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
        {icon}
      </View>
      <AppText variant="bodyLg" className="mb-5 text-center text-muted">
        {message}
      </AppText>
      <PrimaryButton label={ctaLabel} onPress={onCta} className="min-w-[200px]" />
    </View>
  );
}
