import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  AppText,
  LanguageToggle,
  PrimaryButton,
  VoiceInputWidget,
} from "@/components/ui";
import { AdviceCard } from "@/components/home/AdviceCard";
import { DateWeatherCard } from "@/components/home/DateWeatherCard";
import {
  EssentialServicesGrid,
  type ServiceItem,
} from "@/components/home/EssentialServicesGrid";
import { HomeSection } from "@/components/home/HomeSection";
import { PriceHeroCard } from "@/components/home/PriceHeroCard";
import {
  RecentScansRow,
  type RecentScan,
} from "@/components/home/RecentScansRow";
import { useLocale } from "@/context/locale";
import { colors } from "@/constants/theme";

const RECENT_SCANS: RecentScan[] = [
  {
    id: "1",
    titleBn: "ধান ক্ষেত · প্লট ২",
    titleEn: "Rice Paddy · Plot 2",
    timeBn: "গতকাল, সকাল ১০:৩০",
    timeEn: "Yesterday, 10:30 AM",
    status: "healthy",
    gradient: ["#047857", "#10B981"],
    icon: "leaf",
  },
  {
    id: "2",
    titleBn: "টমেটো · বেড ১",
    titleEn: "Tomato · Bed 1",
    timeBn: "২ দিন আগে",
    timeEn: "2 days ago",
    status: "watch",
    gradient: ["#B45309", "#F59E0B"],
    icon: "nutrition",
  },
  {
    id: "3",
    titleBn: "আলু · উত্তর খণ্ড",
    titleEn: "Potato · North plot",
    timeBn: "৩ দিন আগে",
    timeEn: "3 days ago",
    status: "risk",
    gradient: ["#9F1239", "#E11D48"],
    icon: "bug",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    setTranscript(
      locale === "bn"
        ? "আমার ধানের পাতায় বাদামি দাগ দেখা যাচ্ছে"
        : "Brown spots on my rice leaves",
    );
    setRecording(false);
  }, [locale]);

  const services: ServiceItem[] = [
    {
      id: "disease",
      title: t("রোগ নির্ণয়", "Crop Disease"),
      subtitle: t("পাতা স্ক্যান করে জানুন", "Scan leaves to detect"),
      icon: "bug-outline",
      accent: "#D1FAE5",
      onPress: () => router.push("/(root)/(tabs)/scan"),
    },
    {
      id: "market",
      title: t("বাজার দর", "Market Price"),
      subtitle: t("আজকের স্থানীয় দাম", "Today's local rates"),
      icon: "storefront-outline",
      accent: "#ECFDF5",
      onPress: () => router.push("/(root)/(tabs)/market"),
    },
    {
      id: "weather",
      title: t("আবহাওয়া", "Weather"),
      subtitle: t("ক্ষেতের পূর্বাভাস", "Field forecast"),
      icon: "partly-sunny-outline",
      accent: "#D1FAE5",
      onPress: () => {},
    },
    {
      id: "tools",
      title: t("টুলস", "Tools"),
      subtitle: t("কৃষি সহায়ক টুল", "Farm helper tools"),
      icon: "construct-outline",
      accent: "#ECFDF5",
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
                accessibilityRole="button"
                accessibilityLabel={t("বিজ্ঞপ্তি", "Notifications")}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
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

        {/* Breathing space between major blocks */}
        <View className="mt-6 gap-8 px-5">
          <DateWeatherCard />

          <PriceHeroCard
            title={t("আজকের ধানের দাম", "Today's rice price")}
            price={t("৳ ৪৮", "৳ 48")}
            unit={t("/ কেজি", "/ kg")}
            delta={t("৳২", "৳2")}
            meta={t("বাজার · যশোর · সকাল ৯টা", "Market · Jashore · 9 AM")}
            onPress={() => router.push("/(root)/(tabs)/market")}
          />

          <HomeSection
            title={t("কী জানতে চান?", "Ask Aronno")}
            subtitle={t(
              "কথা বলে বা লিখে প্রশ্ন করুন",
              "Ask by voice or text",
            )}
            delay={140}
          >
            <View className="gap-4">
              <VoiceInputWidget
                isRecording={recording}
                transcript={transcript}
                onToggleRecording={() => setRecording((v) => !v)}
                onChangeTranscript={setTranscript}
                placeholder={t(
                  "কথা বলুন বা এখানে লিখুন…",
                  "Speak or type here…",
                )}
                listeningLabel={t("শুনছি… কথা বলুন", "Listening… speak now")}
                editHint={t(
                  "জমা দেওয়ার আগে লেখা ঠিক করুন",
                  "Edit before submit",
                )}
                editLabel={t("সম্পাদনা", "Edit")}
                doneLabel={t("ঠিক আছে", "Done")}
              />
              <PrimaryButton
                label={t("উত্তর দেখুন", "Get answer")}
                onPress={() => {}}
                icon={
                  <Ionicons name="sparkles" size={20} color={colors.white} />
                }
              />
            </View>
          </HomeSection>

          <HomeSection
            title={t("আজকের পরামর্শ", "Today's advice")}
            delay={200}
          >
            <AdviceCard
              title={t("ফসলের পরামর্শ", "Crop advice")}
              headline={t(
                "সম্ভাব্য বাদামি দাগ রোগ",
                "Possible brown spot disease",
              )}
              body={t(
                "মাঝারি ঝুঁকি। আর্দ্র দিনে স্প্রে এড়িয়ে চলুন; সকালে ক্ষেত ঘুরে দেখুন।",
                "Medium risk. Skip spraying on humid days; check the field in the morning.",
              )}
              severity="medium"
              detailsLabel={t("বিস্তারিত", "Details")}
              delay={220}
            />
          </HomeSection>

          <HomeSection
            title={t("জরুরী সেবা", "Essential Services")}
            subtitle={t("এক ট্যাপে দ্রুত কাজ", "Quick actions in one tap")}
            delay={280}
          >
            <EssentialServicesGrid items={services} delay={300} />
          </HomeSection>
        </View>

        <Animated.View
          entering={FadeInDown.delay(360).duration(520).springify()}
          className="mt-9"
        >
          <RecentScansRow
            scans={RECENT_SCANS}
            delay={380}
            onSeeAll={() => router.push("/(root)/(tabs)/history")}
            onPressScan={() => router.push("/(root)/(tabs)/history")}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
