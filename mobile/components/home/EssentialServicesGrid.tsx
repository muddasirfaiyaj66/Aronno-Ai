import type { ComponentProps } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
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
  const scale = useSharedValue(1);
  const accent = item.accent ?? colors.secondary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(delay + index * 90)
        .duration(520)
        .springify()
        .damping(15)}
      style={{ width: TILE_WIDTH }}
    >
      <Pressable
        onPress={item.onPress}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 16, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
      >
        <Animated.View style={[styles.tile, animatedStyle]}>
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
        </Animated.View>
      </Pressable>
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
