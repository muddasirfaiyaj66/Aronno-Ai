import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { AppText, ListenButton, StructuredCard } from "@/components/ui";
import { colors } from "@/constants/theme";
import { getReceiptSummaryById } from "@/types/receipt";

export default function ReceiptResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useMemo(() => getReceiptSummaryById(id), [id]);

  if (!summary) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-neutral px-6"
        edges={["top"]}
      >
        <AppText variant="body" className="text-center text-muted">
          এই তথ্য পাওয়া যায়নি।
        </AppText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">রসিদের হিসাব</AppText>
        <AppText variant="caption" className="mt-1">
          রসিদ থেকে পাওয়া তথ্য
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        <StructuredCard
          title="মোট খরচ"
          icon={<Ionicons name="receipt" size={22} color={colors.primary} />}
          footer={
            <ListenButton
              label="সারাংশ শুনুন"
              onPlay={() => {}}
              onPause={() => {}}
            />
          }
        >
          <View className="gap-4">
            <AppText variant="hero">
              ৳ {new Intl.NumberFormat("bn-BD").format(summary.totalBdt)}
            </AppText>

            <View className="gap-2">
              {summary.items.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3"
                >
                  <View className="flex-1 pr-3">
                    <AppText variant="body" className="font-bengali-bold text-ink">
                      {item.nameBn}
                    </AppText>
                    <AppText variant="caption" className="mt-0.5">
                      {item.quantity}
                    </AppText>
                  </View>
                  <AppText variant="body" className="font-bengali-bold text-primary">
                    {item.price}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </StructuredCard>
      </ScrollView>
    </SafeAreaView>
  );
}
