import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, AppText } from "@/components/ui";
import { colors } from "@/constants/theme";

export default function ScanScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">স্ক্যান</AppText>
        <AppText variant="caption" className="mt-1">
          পাতা বা ফসলের ছবি তুলে রোগ চিনুন
        </AppText>
      </View>
      <EmptyState
        icon={<Ionicons name="camera" size={32} color={colors.primary} />}
        message="এখনো কোনো স্ক্যান নেই। ছবি তুলে শুরু করুন।"
        ctaLabel="ক্যামেরা খুলুন"
        onCta={() => {}}
      />
    </SafeAreaView>
  );
}
