import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { useLocale } from "@/context/locale";
import { colors } from "@/constants/theme";

export type RecentScan = {
  id: string;
  titleBn: string;
  titleEn: string;
  timeBn: string;
  timeEn: string;
  status: "healthy" | "watch" | "risk";
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
};

export type RecentScansRowProps = {
  scans: RecentScan[];
  delay?: number;
  onSeeAll?: () => void;
  onPressScan?: (id: string) => void;
};

const STATUS_STYLE = {
  healthy: { bn: "সুস্থ", en: "Healthy", bg: "#064E3B" },
  watch: { bn: "নজর", en: "Watch", bg: "#B54708" },
  risk: { bn: "ঝুঁকি", en: "Risk", bg: "#B42318" },
} as const;

function ScanCard({
  scan,
  index,
  delay,
  onPress,
}: {
  scan: RecentScan;
  index: number;
  delay: number;
  onPress?: () => void;
}) {
  const { t, locale } = useLocale();
  const scale = useSharedValue(1);
  const status = STATUS_STYLE[scan.status];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(delay + index * 90).duration(460)}
      style={styles.cardWrap}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 16, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        }}
        accessibilityRole="button"
      >
        <Animated.View style={[styles.card, animatedStyle]}>
          <LinearGradient
            colors={scan.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          >
            <View className="absolute inset-0 items-center justify-center">
              <Ionicons name={scan.icon} size={42} color="rgba(255,255,255,0.85)" />
            </View>
            <View
              className="absolute right-3 top-3 rounded-full px-2.5 py-1"
              style={{ backgroundColor: status.bg }}
            >
              <AppText
                variant="caption"
                className="font-bengali-bold"
                style={{ color: "#FFFFFF" }}
              >
                {locale === "bn" ? status.bn : status.en}
              </AppText>
            </View>
          </LinearGradient>

          <View className="px-3.5 py-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              {t(scan.titleBn, scan.titleEn)}
            </AppText>
            <View className="mt-2 flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <AppText variant="caption">
                {t(scan.timeBn, scan.timeEn)}
              </AppText>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export function RecentScansRow({
  scans,
  delay = 0,
  onSeeAll,
  onPressScan,
}: RecentScansRowProps) {
  const { t } = useLocale();

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-5">
        <AppText variant="title">
          {t("সাম্প্রতিক স্ক্যান", "Recent Scans")}
        </AppText>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <AppText variant="body" className="font-bengali-semibold text-primary">
            {t("সব দেখুন", "See all")}
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
        snapToInterval={236}
      >
        {scans.map((scan, index) => (
          <ScanCard
            key={scan.id}
            scan={scan}
            index={index}
            delay={delay}
            onPress={() => onPressScan?.(scan.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 4,
  },
  cardWrap: {
    width: 222,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#064E3B",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  image: {
    height: 132,
    width: "100%",
  },
});
