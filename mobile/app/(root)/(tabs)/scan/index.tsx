import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppText, HeroChoiceCard, ScreenHeader } from "@/components/ui";
import { useLocale } from "@/context/locale";

export default function CaptureLauncherScreen() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title={t("স্ক্যান", "Scan")}
        subtitle={t(
          "পাতার ছবি, বাংলা কণ্ঠ, অথবা লেখা — যেটা সহজ",
          "Leaf photo, Bangla voice, or text — whatever is easier",
        )}
      />

      <View className="flex-1 gap-3 px-5 pt-5">
        <HeroChoiceCard
          tone="photo"
          icon="camera"
          title={t("পাতার ছবি তুলুন", "Photograph a leaf")}
          subtitle={t("রোগ শনাক্ত করুন মুহূর্তে", "Identify the disease instantly")}
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
          subtitle={t("ভয়েসে সমস্যা বর্ণনা করুন", "Describe the problem by voice")}
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
          subtitle={t("কথা না বলে এখানে লিখুন", "Write instead of speaking")}
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/voice",
              params: { flow: "disease", mode: "text" },
            })
          }
        />

        <AppText variant="caption" className="mt-4 text-center leading-6">
          {t(
            "আবহাওয়া খারাপ হলে স্প্রে করার আগে সতর্কতা দেখানো হবে।",
            "You will get a spray warning if rain is likely.",
          )}
        </AppText>
      </View>
    </SafeAreaView>
  );
}
