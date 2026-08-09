import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, AppText } from "@/components/ui";
import { colors } from "@/constants/theme";

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">ইতিহাস</AppText>
        <AppText variant="caption" className="mt-1">
          আগের পরামর্শ ও স্ক্যান এখানে থাকবে
        </AppText>
      </View>
      <EmptyState
        icon={<Ionicons name="time" size={32} color={colors.primary} />}
        message="এখনো কোনো ইতিহাস নেই।"
        ctaLabel="হোমে যান"
        onCta={() => {}}
      />
    </SafeAreaView>
  );
}
