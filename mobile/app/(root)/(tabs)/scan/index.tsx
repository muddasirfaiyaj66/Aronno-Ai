import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { HeroChoiceCard, ScreenHeader } from "@/components/ui";
import { useLocale } from "@/context/locale";

export default function CaptureLauncherScreen() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title={t("স্ক্যান", "Scan")}
        subtitle={t(
          "পাতার ছবি, বাংলা কণ্ঠ, অথবা লেখা",
          "A leaf photo, Bangla voice, or text",
        )}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8 pt-5"
        showsVerticalScrollIndicator={false}
      >
        <HeroChoiceCard
          tone="photo"
          icon="camera"
          title={t("পাতার ছবি তুলুন", "Photograph a leaf")}
          subtitle={t("ক্যামেরা দিয়ে রোগ শনাক্ত করুন", "Identify disease with the camera")}
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
      </ScrollView>
    </SafeAreaView>
  );
}
