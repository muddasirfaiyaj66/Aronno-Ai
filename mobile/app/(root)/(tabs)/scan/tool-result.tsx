import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { AppText, ListingCard, StructuredCard } from "@/components/ui";
import { colors } from "@/constants/theme";
import { getToolResultById } from "@/types/tools";

export default function ToolIdentificationResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useMemo(() => getToolResultById(id), [id]);

  if (!result) {
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
        <AppText variant="title">যন্ত্র শনাক্ত হয়েছে</AppText>
        <AppText variant="caption" className="mt-1">
          AI বিশ্লেষণের ভিত্তিতে প্রাপ্ত ফলাফল
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        <StructuredCard
          title={result.toolNameBn}
          icon={<Ionicons name="construct" size={22} color={colors.primary} />}
        >
          <View className="gap-5">
            <View>
              <AppText variant="caption" className="text-muted">
                {result.toolNameEn}
              </AppText>
              <AppText variant="body" className="mt-2 leading-6 text-ink">
                {result.reasonBn}
              </AppText>
            </View>

            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                কোথায় পাবেন
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {result.listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    sourceName={listing.sourceName}
                    thumbnailUrl={listing.thumbnailUrl}
                    price={listing.price}
                    onPressLink={() => {}}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        </StructuredCard>
      </ScrollView>
    </SafeAreaView>
  );
}
