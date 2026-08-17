import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppText, BentoTile } from "@/components/ui";

export default function CaptureLauncherScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">স্ক্যান</AppText>
        <AppText variant="caption" className="mt-1">
          পাতা বা ফসলের ছবি তুলে অথবা কথা বলে রোগ চিনুন
        </AppText>
      </View>

      <View className="flex-1 justify-center gap-4 px-5">
        <BentoTile
          size="lg"
          icon="camera-outline"
          label="ছবি তুলুন"
          subtitle="পাতা বা ফসলের ছবি তুলুন"
          onPress={() => router.push("/(root)/(tabs)/scan/photo")}
        />
        <BentoTile
          size="lg"
          icon="mic-outline"
          label="কথা বলুন"
          subtitle="সমস্যাটি বলে জানান"
          onPress={() => router.push("/(root)/(tabs)/scan/voice")}
        />
      </View>
    </SafeAreaView>
  );
}
