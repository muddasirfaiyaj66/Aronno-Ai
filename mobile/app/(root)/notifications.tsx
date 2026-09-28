import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppText, EmptyState } from "@/components/ui";
import { colors } from "@/constants/theme";

// TODO(nestjs): replace with a real GET /notifications call once the
// backend is wired.
export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-card px-5 py-4">
        <AppText variant="title">বিজ্ঞপ্তি</AppText>
        <AppText variant="caption" className="mt-1">
          আপনার সাম্প্রতিক বিজ্ঞপ্তি
        </AppText>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          icon={
            <Ionicons
              name="notifications-off-outline"
              size={32}
              color={colors.primary}
            />
          }
          message="কোনো নোটিফিকেশন নেই।"
          ctaLabel="হোমে ফিরুন"
          onCta={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}
