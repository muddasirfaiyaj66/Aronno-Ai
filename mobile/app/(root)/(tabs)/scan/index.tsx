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
          "বাংলা কণ্ঠ অথবা লেখা — ছবির জন্য হোমের একমাত্র বাটন ব্যবহার করুন",
          "Bangla voice or text — use the single home photo button for leaves",
        )}
      />

      <View className="flex-1 gap-3 px-5 pt-5">
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
            "পাতার ছবি তুলতে হোম স্ক্রিনের «পাতার ছবি তুলুন» চাপুন — একটাই বাটন।",
            "To photograph a leaf, use the single «Photograph a leaf» button on Home.",
          )}
        </AppText>
      </View>
    </SafeAreaView>
  );
}
