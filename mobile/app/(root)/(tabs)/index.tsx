import { Dimensions, Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  AppText,
  BentoTile,
  LanguageToggle,
  SensorPlaceholderCard,
} from "@/components/ui";
import {
  InsightHeroCard,
  type InsightItem,
} from "@/components/home/InsightHeroCard";
import { useLocale } from "@/context/locale";
import { colors } from "@/constants/theme";

const SCREEN_PADDING = 20;
const GRID_GAP = 14;
const TILE_WIDTH =
  (Dimensions.get("window").width - SCREEN_PADDING * 2 - GRID_GAP) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLocale();

  const insights: InsightItem[] = [
    {
      id: "weather",
      kind: "weather",
      icon: "rainy-outline",
      message: t(
        "আজ বিকেলে বৃষ্টির সম্ভাবনা — স্প্রে এড়িয়ে চলুন",
        "Rain likely this afternoon — skip spraying",
      ),
    },
    {
      id: "yield",
      kind: "yield",
      icon: "trending-up-outline",
      message: t(
        "এই মৌসুমের ফলন পূর্বাভাস আপডেট হয়েছে",
        "This season's yield forecast is updated",
      ),
      heroNumber: t("৪.২", "4.2"),
      heroUnit: t("টন/একর", "tons/acre"),
    },
    {
      id: "loan",
      kind: "loan",
      icon: "cash-outline",
      message: t(
        "ঋণের পরবর্তী কিস্তি আগামী সপ্তাহে",
        "Your next loan installment is due next week",
      ),
    },
  ];

  const handleInsightPress = (item: InsightItem) => {
    if (item.kind === "weather") router.push("/(root)/(tabs)/scan");
    else if (item.kind === "loan") router.push("/(root)/(tabs)/profile");
  };

  const primaryActions = [
    {
      id: "photo",
      label: t("ছবি তুলুন", "Take a photo"),
      icon: "camera-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan"),
    },
    {
      id: "voice",
      label: t("কথা বলুন", "Speak"),
      icon: "mic-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan"),
    },
  ];

  const bentoItems = [
    {
      id: "fertilizer",
      label: t("সার সুপারিশ", "Fertilizer"),
      icon: "flask-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan/fertilizer"),
    },
    {
      id: "yield",
      label: t("ফলন পূর্বাভাস", "Yield"),
      icon: "stats-chart-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan/yield"),
    },
    {
      id: "tool",
      label: t("যন্ত্র চেনা", "Tool ID"),
      icon: "construct-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan/tools"),
    },
    {
      id: "receipt",
      label: t("রসিদ স্ক্যান", "Receipt Scan"),
      icon: "receipt-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan/receipt"),
    },
    {
      id: "planning",
      label: t("আবহাওয়া–ফসল পরিকল্পনা", "Weather–Crop Plan"),
      icon: "calendar-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/scan/planning"),
    },
    {
      id: "loan",
      label: t("ঋণ", "Loan"),
      icon: "cash-outline" as const,
      onPress: () => router.push("/(root)/(tabs)/profile"),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-16"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(420)}
          className="px-5 pb-2 pt-3"
        >
          <View className="flex-row items-center justify-between">
            <Image
              source={require("@/assets/images/logo-mark.png")}
              accessibilityLabel={t("আরণ্য", "Aronno")}
              style={{ width: 148, height: 44 }}
              resizeMode="contain"
            />
            <View className="flex-row items-center gap-2">
              <LanguageToggle />
              <Pressable
                onPress={() => router.push("/(root)/notifications")}
                accessibilityRole="button"
                accessibilityLabel={t("বিজ্ঞপ্তি", "Notifications")}
                className="h-12 w-12 items-center justify-center rounded-full bg-white"
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={colors.primary}
                />
              </Pressable>
            </View>
          </View>
          <AppText variant="bodyLg" className="mt-4 font-bengali-bold text-ink">
            {t("আসসালামু আলাইকুম", "Welcome back")}
          </AppText>
          <AppText variant="caption" className="mt-1">
            {t("আপনার ক্ষেতের সহজ সহায়ক", "Your simple field assistant")}
          </AppText>
        </Animated.View>

        <View className="mt-6 gap-6 px-5">
          <InsightHeroCard insights={insights} onPress={handleInsightPress} />

          <View className="flex-row gap-4">
            {primaryActions.map((action, index) => (
              <BentoTile
                key={action.id}
                className="flex-1"
                size="lg"
                icon={action.icon}
                label={action.label}
                onPress={action.onPress}
                delay={80 + index * 60}
              />
            ))}
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4">
            {bentoItems.map((item, index) => (
              <BentoTile
                key={item.id}
                style={{ width: TILE_WIDTH }}
                icon={item.icon}
                label={item.label}
                onPress={item.onPress}
                delay={160 + index * 60}
              />
            ))}
          </View>

          <SensorPlaceholderCard
            title={t("মাটি সেন্সর", "Soil Sensor")}
            subtitle={t(
              "হার্ডওয়্যার যুক্ত হলে সরাসরি তথ্য দেখুন",
              "See live readings once hardware is connected",
            )}
            icon={
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color={colors.muted}
              />
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
