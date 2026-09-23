import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  ListenButton,
  ScreenHeader,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetReceiptQuery } from "@/services/api";
import type { ReceiptItem, ReceiptSummary } from "@/types/receipt";

function parseOfflineSummary(params: {
  id?: string;
  totalBdt?: string;
  summaryBn?: string;
  itemsJson?: string;
}): ReceiptSummary | null {
  if (!params.summaryBn && !params.totalBdt) return null;
  let items: ReceiptItem[] = [];
  if (params.itemsJson) {
    try {
      const parsed = JSON.parse(params.itemsJson) as ReceiptItem[];
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }
  }
  return {
    id: params.id ?? "offline-receipt",
    totalBdt: Number(params.totalBdt) || 0,
    summaryBn: params.summaryBn ?? "রসিদের সারাংশ।",
    items,
  };
}

export default function ReceiptResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    offline?: string;
    totalBdt?: string;
    summaryBn?: string;
    itemsJson?: string;
  }>();

  const offlineSummary =
    params.offline === "1"
      ? parseOfflineSummary(params)
      : null;

  const { data: remote, isLoading } = useGetReceiptQuery(params.id!, {
    skip: !params.id || params.offline === "1",
  });

  const summary = offlineSummary ?? remote ?? null;

  if (!offlineSummary && isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6" edges={["top"]}>
        <AIGeneratingShimmer label="রসিদের হিসাব আনা হচ্ছে" lines={4} className="w-full" />
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-neutral px-6"
        edges={["top"]}
      >
        <EmptyState
          icon={
            <Ionicons name="alert-circle-outline" size={32} color={colors.primary} />
          }
          message="এই তথ্য পাওয়া যায়নি।"
          ctaLabel="ফিরে যান"
          onCta={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="রসিদের হিসাব"
        subtitle={
          params.offline === "1"
            ? "অফলাইন — ছবি থেকে খরচ"
            : "ছবি থেকে খরচ — চাইলে বাংলায় শুনুন"
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-16"
      >
        <StructuredCard
          title="মোট খরচ"
          icon={<Ionicons name="receipt" size={22} color={colors.primary} />}
          footer={
            <ListenButton
              label="সারাংশ বাংলায় শুনুন"
              textBn={summary.summaryBn}
            />
          }
        >
          <View className="gap-4">
            <AppText variant="hero">
              ৳ {new Intl.NumberFormat("bn-BD").format(summary.totalBdt)}
            </AppText>
            <AppText variant="body" className="leading-8 text-ink">
              {summary.summaryBn}
            </AppText>
            {summary.items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3"
              >
                <View className="flex-1 pr-3">
                  <AppText variant="body" className="font-bengali-semibold">
                    {item.nameBn}
                  </AppText>
                  <AppText variant="caption" className="text-muted">
                    পরিমাণ: {item.quantity}
                  </AppText>
                </View>
                <AppText variant="body" className="font-bengali-semibold">
                  {item.price}
                </AppText>
              </View>
            ))}
          </View>
        </StructuredCard>
      </ScrollView>
    </SafeAreaView>
  );
}
