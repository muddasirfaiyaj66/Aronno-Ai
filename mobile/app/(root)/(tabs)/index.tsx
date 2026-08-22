import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
import {
  useGetCurrentLoanQuery,
  useGetHistoryQuery,
  useGetWeatherQuery,
} from "@/services/api";

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const name = useAppSelector((s) => s.auth.user?.displayName);
  const { data: history } = useGetHistoryQuery();
  const { data: loan } = useGetCurrentLoanQuery();
  const coords = useFarmLocation();
  const { data: weather } = useGetWeatherQuery(coords ?? {});

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
    const yieldEntry = history?.find((entry) => entry.kind === "yield");
    if (yieldEntry?.kind === "yield") {
      items.push({
        id: yieldEntry.id,
        kind: "yield",
        icon: "trending-up-outline",
        message: t(
          "এই মৌসুমের ফলন পূর্বাভাস আপডেট হয়েছে",
          "This season's yield forecast is updated",
        ),
        heroNumber: String(yieldEntry.yieldValue),
        heroUnit: yieldEntry.yieldUnitBn,
      });
    }
    if (loan) {
      items.push({
        id: loan.id,
        kind: "loan",
        icon: "cash-outline",
        message: loan.nextPaymentDateBn
          ? t(
              `ঋণের পরবর্তী কিস্তি ${loan.nextPaymentDateBn}`,
              `Next loan installment: ${loan.nextPaymentDateBn}`,
            )
          : t("আপনার কৃষি ঋণ চলমান", "Your farm loan is active"),
      });
    }
    return items;
  }, [history, loan, t, weather]);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-20"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#064E3B", "#047857"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <AppText variant="caption" className="font-bengali-semibold text-leaf-300">
                {t("আরণ্য · ক্ষেতের সহচর", "Aronno · field companion")}
              </AppText>
              <AppText
                variant="title"
                className="mt-1 text-white"
                numberOfLines={1}
              >
                {t("আসসালামু আলাইকুম", "Welcome")}
                {name ? `, ${name}` : ""}
              </AppText>
              <AppText variant="body" className="mt-1 text-secondary">
                {t(
                  "ছবি তুলুন, বাংলায় বলুন, অথবা লিখুন",
                  "Take a photo, speak Bangla, or type",
                )}
              </AppText>
            </View>
            <View className="flex-row items-center gap-2">
              <LanguageToggle light />
              <Pressable
                onPress={() => router.push("/(root)/notifications")}
                accessibilityRole="button"
                accessibilityLabel={t("বিজ্ঞপ্তি", "Notifications")}
                className="h-12 w-12 items-center justify-center rounded-full bg-white/15"
              >
                <Ionicons name="notifications-outline" size={22} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        <View className="-mt-4 gap-5 px-5">
          <DateWeatherCard weather={weather} />

          <HomeSection
            title={t("আজকের কাজ", "Today")}
            subtitle={t(
              "এক ট্যাপে রোগ চিনুন — ছবি, কণ্ঠ, বা লেখা",
              "One tap to identify disease — photo, voice, or text",
            )}
          >
            <View className="gap-3">
              <HeroChoiceCard
                tone="photo"
                icon="camera"
                title={t("পাতার ছবি তুলুন", "Photograph a leaf")}
                subtitle={t(
                  "রোগ শনাক্ত করুন মুহূর্তে",
                  "Identify the disease instantly",
                )}
                onPress={() =>
                  router.push({
                    pathname: "/(root)/(tabs)/scan/photo",
                    params: { flow: "disease" },
                  })
                }
              />
              <HeroChoiceCard
                tone="voice"
                icon="mic"
                title={t("বাংলায় বলুন", "Speak in Bangla")}
                subtitle={t(
                  "সমস্যাটি কণ্ঠে বর্ণনা করুন",
                  "Describe the problem out loud",
                )}
                onPress={() =>
                  router.push({
                    pathname: "/(root)/(tabs)/scan/voice",
                    params: { flow: "disease" },
                  })
                }
              />
              <HeroChoiceCard
                tone="text"
                icon="create-outline"
                title={t("লিখে জানান", "Type it")}
                subtitle={t(
                  "কথা বলতে না পারলে এখানে লিখুন",
                  "Write if you prefer not to speak",
                )}
                onPress={() =>
                  router.push({
                    pathname: "/(root)/(tabs)/scan/voice",
                    params: { flow: "disease", mode: "text" },
                  })
                }
              />
            </View>
          </HomeSection>

          {insights.length > 0 ? (
            <InsightHeroCard
              insights={insights}
              onPress={(item) => {
                if (item.kind === "weather") router.push("/(root)/(tabs)/scan/planning");
                else if (item.kind === "disease") router.push("/(root)/(tabs)/history");
                else if (item.kind === "yield") router.push("/(root)/(tabs)/scan/yield");
                else if (item.kind === "loan") router.push("/(root)/loan/overview");
              }}
            />
          ) : null}

          <HomeSection
            title={t("আরও সহায়তা", "More help")}
            subtitle={t("সার, ফলন, যন্ত্র, রসিদ, বাজার", "Fertilizer, yield, tools, receipts, market")}
          >
            <EssentialServicesGrid
              items={[
                {
                  id: "fertilizer",
                  title: t("সার", "Fertilizer"),
                  subtitle: t("কী দেবেন, কতটা", "What and how much"),
                  icon: "flask-outline",
                  onPress: () => router.push("/(root)/(tabs)/scan/fertilizer"),
                },
                {
                  id: "yield",
                  title: t("ফলন", "Yield"),
                  subtitle: t("এবার কত হতে পারে", "Season forecast"),
                  icon: "stats-chart-outline",
                  onPress: () => router.push("/(root)/(tabs)/scan/yield"),
                },
                {
                  id: "tool",
                  title: t("যন্ত্র", "Tools"),
                  subtitle: t("ছবি বা কথা দিয়ে খুঁজুন", "Find by photo or voice"),
                  icon: "construct-outline",
                  onPress: () => router.push("/(root)/(tabs)/scan/tools"),
                },
                {
                  id: "receipt",
                  title: t("রসিদ", "Receipt"),
                  subtitle: t("ছবি তুলুন — খরচ শুনুন", "Photo, then hear the cost"),
                  icon: "receipt-outline",
                  onPress: () => router.push("/(root)/(tabs)/scan/receipt"),
                },
                {
                  id: "planning",
                  title: t("পরিকল্পনা", "Plan"),
                  subtitle: t("আবহাওয়া মেনে ফসল", "Weather-aware crops"),
                  icon: "calendar-outline",
                  onPress: () => router.push("/(root)/(tabs)/scan/planning"),
                },
                {
                  id: "market",
                  title: t("বাজার", "Market"),
                  subtitle: t("দাম দেখুন, বিক্রি করুন", "Prices and selling"),
                  icon: "storefront-outline",
                  onPress: () => router.push("/(root)/(tabs)/market"),
                },
              ]}
            />
          </HomeSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
