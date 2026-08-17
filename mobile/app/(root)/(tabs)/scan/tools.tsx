import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppText, BentoTile } from "@/components/ui";

export default function ToolIdentificationScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">যন্ত্র চেনা</AppText>
        <AppText variant="caption" className="mt-1">
          যন্ত্রের ছবি তুলে অথবা কথা বলে জেনে নিন
        </AppText>
      </View>

      <View className="flex-1 justify-center gap-4 px-5">
        <BentoTile
          size="lg"
          icon="camera-outline"
          label="ছবি তুলুন"
          subtitle="যন্ত্রের ছবি তুলুন"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/photo",
              params: { flow: "tool" },
            })
          }
        />
        <BentoTile
          size="lg"
          icon="mic-outline"
          label="কথা বলুন"
          subtitle="আপনার কাজটি বলুন"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/voice",
              params: { flow: "tool" },
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}
