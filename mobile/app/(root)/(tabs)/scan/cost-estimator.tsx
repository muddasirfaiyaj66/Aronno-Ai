import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { CostEstimatorPanel } from "@/components/cost/CostEstimatorPanel";

export default function CostEstimatorScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-card px-5 py-4">
        <AppText variant="title">খরচের হিসাব</AppText>
        <AppText variant="caption" className="mt-1">
          ফসল ও জমির পরিমাণ দিয়ে আনুমানিক খরচ জানুন
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-5 pb-16"
        keyboardShouldPersistTaps="handled"
      >
        <CostEstimatorPanel />
      </ScrollView>
    </SafeAreaView>
  );
}
