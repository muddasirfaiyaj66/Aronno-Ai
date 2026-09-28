import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  HeroChoiceCard,
  LanguageToggle,
} from "@/components/ui";
import { HomeSection } from "@/components/home/HomeSection";
import { EssentialServicesGrid } from "@/components/home/EssentialServicesGrid";
import { DateWeatherCard } from "@/components/home/DateWeatherCard";
import { InsightHeroCard, type InsightItem } from "@/components/home/InsightHeroCard";
import { useLocale } from "@/context/locale";
import { useAppSelector } from "@/store";
import { colors } from "@/constants/theme";
import { useFarmLocation } from "@/hooks/useFarmLocation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import {
  useGetHistoryQuery,
  useGetWeatherQuery,
} from "@/services/api";

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const name = useAppSelector((s) => s.auth.user?.displayName);
  const { data: history, refetch: refetchHistory } = useGetHistoryQuery();
  const location = useFarmLocation();
  const { data: weather, refetch: refetchWeather } = useGetWeatherQuery(
    location.coords ?? {},
    {
      skip: location.status === "loading",
    },
  );

  const refreshHome = useCallback(async () => {
    await Promise.all([
      refetchHistory(),
      location.coords ? refetchWeather() : Promise.resolve(),
      location.refresh(false),
    ]);
  }, [refetchHistory, refetchWeather, location.coords, location.refresh]);

  const { refreshControl } = usePullToRefresh(refreshHome);

  const insights = useMemo(() => {
    const items: InsightItem[] = [];
    if (weather) {
      items.push({
        id: "weather-live",
        kind: "weather",
        icon:
          weather.kind === "rainy" || weather.kind === "storm"
            ? "rainy-outline"
            : "partly-sunny-outline",
        message:
          weather.precipProb >= 40
            ? t(
                `${weather.conditionBn} — স্প্রে করার আগে আকাশ দেখুন`,
                `${weather.conditionEn} — check the sky before spraying`,
              )
            : t(
                `এখন ${weather.conditionBn}, ${weather.tempC}°`,
                `Now ${weather.conditionEn}, ${weather.tempC}°`,
              ),
      });
    }
    const disease = history?.find((entry) => entry.kind === "disease");
    if (disease?.kind === "disease") {
      items.push({
        id: disease.id,
        kind: "disease",
        icon: "leaf-outline",
        message: `${disease.cropNameBn} — ${disease.diseaseNameBn}`,
      });
    }
    return items;
  }, [history, t, weather]);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-28"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View className="px-5 pb-4 pt-3">
          <LinearGradient
            colors={["#134E4A", "#0F766E", "#1AA88A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 28, paddingHorizontal: 18, paddingVertical: 18 }}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <AppText
                  variant="caption"
                  className="font-bengali-semibold"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  {t("আরণ্য", "Aronno")}
                </AppText>
                <AppText variant="title" className="mt-1" style={{ color: colors.white }}>
                  {name
                    ? t(`স্বাগতম, ${name.split(/\s+/)[0]}`, `Welcome, ${name.split(/\s+/)[0]}`)
                    : t("স্বাগতম", "Welcome")}
                </AppText>
                <AppText
                  variant="caption"
                  className="mt-1"
                  style={{ color: "rgba(255,255,255,0.82)" }}
                >
                  {t("ক্ষেত, আবহাওয়া ও বাজার — এক জায়গায়", "Field, weather, and market in one place")}
                </AppText>
              </View>
              <View className="flex-row items-center gap-2">
                <LanguageToggle light />
                <Pressable
                  onPress={() => router.push("/(root)/notifications")}
                  accessibilityRole="button"
                  accessibilityLabel={t("বিজ্ঞপ্তি", "Notifications")}
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                >
                  <Ionicons name="notifications-outline" size={22} color={colors.white} />
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View className="gap-6 px-5">
          <DateWeatherCard
            weather={weather}
            locationStatus={location.status}
            locationLabel={location.labelBn}
            onEnableLocation={() => {
              void location.refresh(true);
            }}
          />

          <HomeSection
            title={t("রোগ চিনুন", "Identify disease")}
            subtitle={t(
              "একবার চাপুন — পাতার ছবি তুলুন",
              "One tap — photograph a leaf",
            )}
          >
            <HeroChoiceCard
              tone="photo"
              icon="camera"
              title={t("পাতার ছবি তুলুন", "Photograph a leaf")}
              subtitle={t("রোগ শনাক্ত করুন", "Identify the disease")}
              onPress={() =>
                router.push({
                  pathname: "/(root)/(tabs)/scan/photo",
                  params: { flow: "disease" },
                })
              }
            />
          </HomeSection>

          {insights.length > 0 ? (
            <InsightHeroCard
              insights={insights}
              onPress={(item) => {
                if (item.kind === "weather") router.push("/(root)/(tabs)/scan/planning");
                else if (item.kind === "disease") router.push("/(root)/(tabs)/history");
              }}
            />
          ) : null}

          <HomeSection
            title={t("আরও সহায়তা", "More help")}
            subtitle={t(
              "সার, মাটি, যন্ত্র, রসিদ, পরিকল্পনা, বাজার",
              "Fertilizer, soil, tools, receipts, plan, market",
            )}
          >
            <EssentialServicesGrid
              items={[
                {
                  id: "fertilizer",
                  title: t("সার", "Fertilizer"),
                  subtitle: t("জমির তথ্য দিয়ে পরামর্শ", "Advice from field details"),
                  icon: "flask-outline",
                  accent: "#FBF4E6",
                  iconColor: "#C4841D",
                  onPress: () => router.push("/(root)/(tabs)/scan/fertilizer"),
                },
                {
                  id: "soil",
                  title: t("মাটি", "Soil"),
                  subtitle: t("ব্লুটুথ / ওয়াই‑ফাই সেন্সর", "Bluetooth / Wi‑Fi sensor"),
                  icon: "hardware-chip-outline",
                  accent: "#E7F1FB",
                  iconColor: "#1D4E89",
                  onPress: () => router.push("/(root)/(tabs)/scan/soil-sensor"),
                },
                {
                  id: "tool",
                  title: t("যন্ত্র", "Tools"),
                  subtitle: t("ছবি বা কথা দিয়ে খুঁজুন", "Find by photo or voice"),
                  icon: "construct-outline",
                  accent: "#F3E8FF",
                  iconColor: "#6D28D9",
                  onPress: () => router.push("/(root)/(tabs)/scan/tools"),
                },
                {
                  id: "receipt",
                  title: t("রসিদ", "Receipt"),
                  subtitle: t("ছবি তুলুন — খরচ শুনুন", "Photo, then hear the cost"),
                  icon: "receipt-outline",
                  accent: "#FDECEC",
                  iconColor: "#B42318",
                  onPress: () => router.push("/(root)/(tabs)/scan/receipt"),
                },
                {
                  id: "planning",
                  title: t("পরিকল্পনা", "Plan"),
                  subtitle: t("আবহাওয়া মেনে ফসল", "Weather-aware crops"),
                  icon: "calendar-outline",
                  accent: "#E7F5F2",
                  iconColor: "#0F766E",
                  onPress: () => router.push("/(root)/(tabs)/scan/planning"),
                },
                {
                  id: "market",
                  title: t("বাজার", "Market"),
                  subtitle: t("দাম দেখুন, বিক্রি করুন", "Prices and selling"),
                  icon: "storefront-outline",
                  accent: "#FFF4E5",
                  iconColor: "#C2410C",
                  onPress: () => router.push("/(root)/(tabs)/market"),
                },
                {
                  id: "assistant",
                  title: t("চ্যাট", "Chat"),
                  subtitle: t("লেখা বা কণ্ঠে জিজ্ঞাসা", "Ask by text or voice"),
                  icon: "chatbubbles-outline",
                  accent: "#E8F8F4",
                  iconColor: "#0F766E",
                  onPress: () => router.push("/(root)/(tabs)/assistant"),
                },
              ]}
            />
          </HomeSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
