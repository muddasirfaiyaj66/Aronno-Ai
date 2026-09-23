import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  ListingCard,
  RetryCard,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetPublicShopQuery } from "@/services/api";

export default function PublicShopScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: shop,
    isLoading,
    isError,
    refetch,
  } = useGetPublicShopQuery(id ?? "", {
    skip: !id,
  });

  const districtName = shop?.district?.nameBn ?? "";
  const locationText = [districtName, shop?.upazila, shop?.address]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header Bar */}
      <View className="flex-row items-center gap-3 border-b border-border bg-white px-5 py-3.5">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="subtitle" className="font-bengali-bold text-ink" numberOfLines={1}>
            {shop?.name ?? "দোকান"}
          </AppText>
          <AppText variant="caption" className="text-muted">
            বিক্রেতার দোকান ও পণ্যসামগ্রী
          </AppText>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {isError ? (
          <RetryCard
            message="দোকানের তথ্য লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।"
            onRetry={refetch}
          />
        ) : isLoading ? (
          <AIGeneratingShimmer label="দোকানের তথ্য আনা হচ্ছে" lines={4} className="w-full" />
        ) : shop ? (
          <>
            {/* Shop Overview Header */}
            <StructuredCard
              title={shop.name}
              icon={<Ionicons name="storefront" size={22} color={colors.primary} />}
            >
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  {shop.logoUrl ? (
                    <Image
                      source={{ uri: shop.logoUrl }}
                      className="h-20 w-20 rounded-2xl bg-neutral"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                      <Ionicons name="storefront" size={32} color={colors.primary} />
                    </View>
                  )}
                  <View className="flex-1">
                    <AppText variant="subtitle" className="font-bengali-bold text-ink">
                      {shop.name}
                    </AppText>
                    {shop.owner ? (
                      <AppText variant="caption" className="text-muted mt-0.5">
                        বিক্রেতা: {shop.owner.displayName}
                      </AppText>
                    ) : null}
                    {locationText ? (
                      <AppText variant="caption" className="text-muted mt-0.5">
                        📍 {locationText}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" className="text-muted mt-0.5">
                      📞 {shop.phone}
                    </AppText>
                  </View>
                </View>

                {shop.description ? (
                  <AppText variant="body" className="font-bengali-medium text-ink">
                    {shop.description}
                  </AppText>
                ) : null}
              </View>
            </StructuredCard>

            {/* Shop Products Section */}
            <View className="gap-3 mt-2">
              <AppText variant="title" className="font-bengali-bold text-ink">
                দোকানের পণ্যসামগ্রী ({new Intl.NumberFormat("bn-BD").format(shop.products?.length ?? 0)})
              </AppText>

              {!shop.products || shop.products.length === 0 ? (
                <EmptyState
                  icon={<Ionicons name="cube-outline" size={32} color={colors.primary} />}
                  message="এই দোকানে এখনো কোনো সক্রিয় পণ্য নেই।"
                  ctaLabel="রিফ্রেশ করুন"
                  onCta={refetch}
                />
              ) : (
                <View className="flex-row flex-wrap gap-3">
                  {shop.products.map((product) => (
                    <ListingCard
                      key={product.id}
                      sourceName={`${product.name} · ${product.availableQuantity} ${product.unit}`}
                      thumbnailUrl={product.images?.[0]?.url}
                      price={`৳ ${product.pricePerUnit}/${product.unit}`}
                      onPressLink={() => {
                        // Navigate to product detail or order view
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
