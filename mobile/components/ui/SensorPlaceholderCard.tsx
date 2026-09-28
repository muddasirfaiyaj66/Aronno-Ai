import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type SensorPlaceholderCardProps = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badgeLabel?: string;
  toastMessage?: string;
  className?: string;
};

export function SensorPlaceholderCard({
  title,
  subtitle,
  icon,
  badgeLabel = "শীঘ্রই আসছে",
  toastMessage = "এই ফিচারটি শীঘ্রই যুক্ত হবে।",
  className = "",
}: SensorPlaceholderCardProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showToast = () => {
    setToastVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setToastVisible(false), 1800);
  };

  return (
    <View className={className}>
      <Pressable
        onPress={showToast}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${title}. ${badgeLabel}`}
      >
        <View
          className="overflow-hidden rounded-3xl bg-neutral-100"
          style={[styles.card, { borderColor: colors.border }]}
        >
          <View className="flex-row items-center gap-3 px-5 pt-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-neutral-200">
              {icon}
            </View>
            <View className="flex-1">
              <AppText variant="bodyLg" className="font-bengali-bold text-muted">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="caption" className="mt-0.5">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <View className="rounded-full bg-neutral-200 px-3 py-1.5">
              <AppText variant="caption" className="font-bengali-semibold text-muted">
                {badgeLabel}
              </AppText>
            </View>
          </View>

          <View className="gap-2 px-5 pb-5 pt-4">
            <View className="h-3 w-2/3 rounded-full bg-neutral-200" />
            <View className="h-3 w-1/3 rounded-full bg-neutral-200" />
          </View>
        </View>
      </Pressable>

      {toastVisible ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(220)}
          className="mt-2 items-center rounded-2xl bg-neutral-900 px-4 py-3"
        >
          <AppText variant="caption" className="text-center text-white">
            {toastMessage}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "rgba(209,213,219,0.7)",
  },
});
