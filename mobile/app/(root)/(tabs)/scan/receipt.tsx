import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";

export default function ReceiptScanScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">রসিদ স্ক্যান</AppText>
        <AppText variant="caption" className="mt-1">
          কেনাকাটার রসিদের ছবি তুলে খরচের হিসাব রাখুন
        </AppText>
      </View>

      <View className="flex-1 items-center justify-center gap-5 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <Ionicons name="receipt-outline" size={36} color={colors.primary} />
        </View>
        <AppText variant="body" className="text-center leading-6 text-muted">
          রসিদটি সমতল জায়গায় রেখে পুরো লেখা স্পষ্টভাবে ফ্রেমে আনুন।
        </AppText>
        <PrimaryButton
          label="ছবি তুলুন"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/photo",
              params: { flow: "receipt" },
            })
          }
          icon={<Ionicons name="camera-outline" size={20} color={colors.white} />}
        />
      </View>
    </SafeAreaView>
  );
}
