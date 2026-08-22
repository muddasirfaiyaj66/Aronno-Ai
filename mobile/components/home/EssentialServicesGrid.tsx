import type { ComponentProps } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { TiltPressable } from "@/components/ui/TiltPressable";
import { colors } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type ServiceItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  accent?: string;
};

export type EssentialServicesGridProps = {
  items: ServiceItem[];
  delay?: number;
};

const SCREEN_PADDING = 20;
const GAP = 14;
const TILE_WIDTH =
  (Dimensions.get("window").width - SCREEN_PADDING * 2 - GAP) / 2;

function ServiceTile({
  item,
  index,
  delay,
}: {
  item: ServiceItem;
  index: number;
  delay: number;
}) {
  const accent = item.accent ?? colors.secondary;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay + index * 90)
        .duration(520)
        .springify()
        .damping(15)}
      style={{ width: TILE_WIDTH }}
    >
      <TiltPressable
        onPress={item.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        contentStyle={styles.tile}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: accent }}
        >
          <Ionicons name={item.icon} size={22} color={colors.primary} />
        </View>
        <AppText
          variant="body"
          numberOfLines={1}
          className="mt-3 font-bengali-bold text-ink"
        >
          {item.title}
        </AppText>
        <AppText variant="caption" numberOfLines={2} className="mt-1 leading-5">
          {item.subtitle}
        </AppText>
      </TiltPressable>
    </Animated.View>
  );
}

export function EssentialServicesGrid({
  items,
  delay = 0,
}: EssentialServicesGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item, index) => (
        <ServiceTile key={item.id} item={item} index={index} delay={delay} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: GAP,
  },
  tile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
