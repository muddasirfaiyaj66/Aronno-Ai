import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";

export type HomeSectionProps = {
  title: string;
  subtitle?: string;
  delay?: number;
  children: ReactNode;
  action?: ReactNode;
};

export function HomeSection({
  title,
  subtitle,
  delay = 0,
  children,
  action,
}: HomeSectionProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(520).springify()}
      className="gap-4"
    >
      <View className="mb-1 flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <AppText variant="title">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" className="mt-1.5 leading-5">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Animated.View>
  );
}
