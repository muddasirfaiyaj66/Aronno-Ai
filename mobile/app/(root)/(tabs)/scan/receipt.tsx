import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppText, HeroChoiceCard, ScreenHeader } from "@/components/ui";

export default function ReceiptScanScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="রসিদের খরচ"
        subtitle="ছবি তুলুন — বাংলায় শুনুন কত খরচ হয়েছে"
      />

      <View className="flex-1 gap-4 px-5 pt-5">
        <HeroChoiceCard
          tone="photo"
          icon="camera"
          title="রসিদের ছবি তুলুন"
          subtitle="পুরো লেখা ফ্রেমে আনুন, সমতল জায়গায় রাখুন"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/photo",
              params: { flow: "receipt" },
            })
          }
        />
        <AppText variant="body" className="leading-8 text-muted">
          স্ক্যানের পর ফলাফল পর্দায় বড় করে দেখাবে, আর চাইলে «শুনুন বাংলায়» চাপুন।
        </AppText>
      </View>
    </SafeAreaView>
  );
}
