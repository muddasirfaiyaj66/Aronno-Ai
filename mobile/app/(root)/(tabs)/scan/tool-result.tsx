import { Linking, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  ListenButton,
  ListingCard,
  ScreenHeader,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetToolQuery } from "@/services/api";

export default function ToolIdentificationResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    offline?: string;
    toolNameBn?: string;
    toolNameEn?: string;
    reasonBn?: string;
  }>();
  const offline = params.offline === "1";
  const { data: remote, isLoading } = useGetToolQuery(params.id!, {
    skip: !params.id || offline,
  });

  const result = offline
    ? {
        toolNameBn: params.toolNameBn ?? "",
        toolNameEn: params.toolNameEn ?? "",
        reasonBn: params.reasonBn ?? "",
        listings: [] as {
          id: string;
          sourceName: string;
          thumbnailUrl: string;
          price?: string;
          externalUrl: string;
        }[],
      }
    : remote;

  if (!offline && isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6" edges={["top"]}>
        <AIGeneratingShimmer label="যন্ত্রের তথ্য আনা হচ্ছে" lines={4} className="w-full" />
      </SafeAreaView>
    );
  }

  if (!result || !result.toolNameBn) {
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
        title="যন্ত্র শনাক্ত হয়েছে"
        subtitle={
          offline
            ? "অফলাইন বিশ্লেষণ — বাজার তালিকা ইন্টারনেট লাগবে"
            : "Gemini বিশ্লেষণ — কোথায় পাবেন তা নিচে"
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 py-5 pb-16"
        showsVerticalScrollIndicator
      >
        <StructuredCard
          title={result.toolNameBn}
          icon={<Ionicons name="construct" size={22} color={colors.primary} />}
        >
          <View className="gap-3">
            <AppText variant="caption" className="text-muted">
              {result.toolNameEn}
            </AppText>
            <AppText variant="body" className="leading-8 text-ink">
              {result.reasonBn}
            </AppText>
          </View>
        </StructuredCard>

        <ListenButton
          label="কারণ শুনুন"
          textBn={`${result.toolNameBn}. ${result.reasonBn}`}
        />

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            কোথায় পাবেন
          </AppText>
          {result.listings.length === 0 ? (
            <AppText variant="caption" className="leading-6">
              {offline
                ? "অফলাইনে দোকানের তালিকা দেখানো যায় না। অনলাইনে আবার স্ক্যান করলে বাজার লিংক আসবে।"
                : "এখন কোনো তালিকা নেই।"}
            </AppText>
          ) : (
            result.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                layout="row"
                sourceName={listing.sourceName}
                thumbnailUrl={listing.thumbnailUrl}
                price={listing.price}
                onPressLink={() => {
                  if (listing.externalUrl) void Linking.openURL(listing.externalUrl);
                }}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
