import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ui";
import { CostEstimatorPanel } from "@/components/cost/CostEstimatorPanel";

export default function CostEstimatorScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="খরচের হিসাব"
        subtitle="ফসল ও জমির পরিমাণ দিয়ে আনুমানিক খরচ জানুন"
      />

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
