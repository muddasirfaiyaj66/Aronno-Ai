import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppText,
  EmptyState,
  ListenButton,
  ScreenHeader,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetReceiptQuery, useSpeakMutation } from "@/services/api";

export default function ReceiptResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: summary } = useGetReceiptQuery(id!, { skip: !id });
  const [speak] = useSpeakMutation();

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
        subtitle="ছবি থেকে খরচ — চাইলে বাংলায় শুনুন"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        <StructuredCard
          title="মোট খরচ"
          icon={<Ionicons name="receipt" size={22} color={colors.primary} />}
          footer={
            <ListenButton
              label="সারাংশ বাংলায় শুনুন"
              onPlay={() => speak({ textBn: summary.summaryBn })}
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
