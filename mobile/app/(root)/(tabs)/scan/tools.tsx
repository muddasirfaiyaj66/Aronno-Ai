import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { HeroChoiceCard, ScreenHeader } from "@/components/ui";

export default function ToolIdentificationScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="যন্ত্র খুঁজুন"
        subtitle="ছবি তুলুন, বাংলায় বলুন, অথবা লিখুন"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 py-5 pb-10"
      >
        <HeroChoiceCard
          tone="photo"
          icon="camera"
          title="যন্ত্রের ছবি তুলুন"
          subtitle="কাছাকাছি ও অনলাইনে খুঁজে দেব"
          onPress={() =>
            router.push({
              pathname: "/(root)/camera",
              params: { flow: "tool" },
            })
          }
        />
        <HeroChoiceCard
          tone="voice"
          icon="mic"
          title="কাজটি বাংলায় বলুন"
          subtitle="যেমন: ঘাস কাটার যন্ত্র দরকার"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/voice",
              params: { flow: "tool" },
            })
          }
        />
        <HeroChoiceCard
          tone="text"
          icon="create-outline"
          title="লিখে জানান"
          subtitle="কথা না বলে কাজটি লিখুন"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/voice",
              params: { flow: "tool", mode: "text" },
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
