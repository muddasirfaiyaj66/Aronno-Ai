import { useState } from "react";
import { Image, Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  PrimaryButton,
  RetryCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { AddProductModal } from "@/components/market/AddProductModal";
import {
  useGetMeQuery,
  useGetMyShopQuery,
  useGetPublicShopQuery,
} from "@/services/api";
import { formatPriceBn, formatUnitBn, toBn } from "@/utils/marketFormatters";

export default function PublicShopScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [addProductModalVisible, setAddProductModalVisible] = useState(false);

  // Fetch current user and myShop for ownership detection
  const { data: currentUser } = useGetMeQuery();
  const { data: myShop } = useGetMyShopQuery();

  const {
    data: shop,
    isLoading,
    isError,
    refetch,
  } = useGetPublicShopQuery(id ?? "", {
    skip: !id,
  });

  const isOwner = Boolean(
    shop &&
      (currentUser?.id === shop.ownerUserId || (myShop && myShop.id === shop.id)),
  );

  const districtName = shop?.district?.nameBn ?? "";
  const locationText = [districtName, shop?.upazila, shop?.address]
    .filter(Boolean)
    .join(" · ");

  const handleCallSeller = () => {
    if (shop?.phone) {
      void Linking.openURL(`tel:${shop.phone}`);
    }
  };

  const activeProducts = shop?.products ?? [];

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header Bar */}
      <View className="flex-row items-center gap-3 border-b border-border bg-card px-5 py-3.5">
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
            {isOwner ? "আপনার পাবলিক দোকান পেজ" : "বিক্রেতার দোকান ও পণ্যসামগ্রী"}
          </AppText>
        </View>
        {isOwner ? (
          <View className="rounded-full bg-primary/10 px-3 py-1">
            <AppText variant="caption" className="font-bengali-bold text-primary">
              মালিক
            </AppText>
          </View>
        ) : null}
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
            {/* Owner Alert Banner if Viewing Own Shop */}
            {isOwner ? (
              <View className="flex-row items-center justify-between rounded-2xl bg-primary/10 p-3.5 border border-primary/20">
                <View className="flex-row items-center gap-2 flex-1 pr-2">
                  <Ionicons name="information-circle" size={20} color={colors.primary} />
                  <AppText variant="caption" className="font-bengali-medium text-ink flex-1">
                    এটি আপনার পাবলিক দোকান পেজ। ক্রেতারা আপনার পণ্যগুলো যেভাবে দেখতে পান।
                  </AppText>
                </View>
                <Pressable
                  onPress={() => setAddProductModalVisible(true)}
                  className="rounded-xl bg-forest-700 px-3 py-1.5 flex-row items-center gap-1"
                >
                  <Ionicons name="add" size={16} color={colors.white} />
                  <AppText variant="caption" className="font-bengali-bold text-white">
                    পণ্য যোগ করুন
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {/* Shop Header Card */}
            <StructuredCard
              title={shop.name}
              icon={<Ionicons name="storefront" size={22} color={colors.primary} />}
              footer={
                isOwner ? (
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <PrimaryButton
                        label="পণ্য যোগ করুন"
                        onPress={() => setAddProductModalVisible(true)}
                        icon={<Ionicons name="add-circle" size={18} color={colors.white} />}
                      />
                    </View>
                    <View className="flex-1">
                      <SecondaryButton
                        label="আমার পণ্য"
                        onPress={() => router.push("/(root)/shop/my-products")}
                        icon={<Ionicons name="cube-outline" size={18} color={colors.ink} />}
                      />
                    </View>
                  </View>
                ) : (
                  <PrimaryButton
                    label="বিক্রেতাকে কল করুন"
                    onPress={handleCallSeller}
                    icon={<Ionicons name="call" size={18} color={colors.white} />}
                  />
                )
              }
            >
              <View className="gap-3">
                {/* Shop Banner or Logo */}
                <View className="relative h-40 w-full overflow-hidden rounded-2xl bg-neutral border border-border/40">
                  {shop.bannerUrl || shop.logoUrl ? (
                    <Image
                      source={{ uri: (shop.bannerUrl || shop.logoUrl) ?? undefined }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-primary/10">
                      <Ionicons name="storefront" size={48} color={colors.primary} />
                    </View>
                  )}

                  {shop.logoUrl && shop.bannerUrl ? (
                    <Image
                      source={{ uri: shop.logoUrl }}
                      className="absolute bottom-2 left-2 h-14 w-14 rounded-xl border-2 border-white bg-neutral"
                      resizeMode="cover"
                    />
                  ) : null}
                </View>

                {/* Shop Title & Details */}
                <View className="gap-1">
                  <AppText variant="title" className="font-bengali-bold text-ink">
                    {shop.name}
                  </AppText>

                  {shop.owner?.displayName ? (
                    <AppText variant="caption" className="text-muted font-bengali-medium">
                      বিক্রেতা: {shop.owner.displayName}
                    </AppText>
                  ) : null}

                  {locationText ? (
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name="location-outline" size={14} color={colors.muted} />
                      <AppText variant="caption" className="text-muted font-bengali-medium flex-1">
                        {locationText}
                      </AppText>
                    </View>
                  ) : null}

                  <View className="flex-row items-center gap-1">
                    <Ionicons name="call-outline" size={14} color={colors.muted} />
                    <AppText variant="caption" className="text-muted font-bengali-medium">
                      {shop.phone}
                    </AppText>
                  </View>

                  {/* Shop Rating */}
                  <View className="flex-row items-center gap-1.5 mt-1 bg-amber-50 self-start px-2.5 py-1 rounded-full border border-amber-200">
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <AppText variant="caption" className="font-bengali-bold text-amber-800">
                      {shop.avgRating ? toBn(shop.avgRating.toFixed(1)) : "০.০"}
                    </AppText>
                    <AppText variant="caption" className="font-bengali-medium text-amber-700">
                      ({toBn(shop.reviewCount ?? 0)}টি রেটিং)
                    </AppText>
                  </View>
                </View>

                {shop.description ? (
                  <View className="border-t border-border/40 pt-2">
                    <AppText variant="body" className="font-bengali-medium text-ink leading-relaxed">
                      {shop.description}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </StructuredCard>

            {/* Section: "এই দোকানের পণ্য" */}
            <View className="gap-3 mt-1">
              <View className="flex-row items-center justify-between px-1">
                <AppText variant="title" className="font-bengali-bold text-ink">
                  এই দোকানের পণ্য ({toBn(activeProducts.length)})
                </AppText>
              </View>

              {activeProducts.length === 0 ? (
                <EmptyState
                  icon={<Ionicons name="cube-outline" size={32} color={colors.primary} />}
                  message="এই দোকানে বর্তমানে কোনো সক্রিয় পণ্য নেই।"
                  ctaLabel={isOwner ? "পণ্য যোগ করুন" : "রিফ্রেশ করুন"}
                  onCta={isOwner ? () => setAddProductModalVisible(true) : refetch}
                />
              ) : (
                <View className="flex-row flex-wrap gap-3">
                  {activeProducts.map((product: any) => {
                    const imageUrl = product.images?.[0]?.url;
                    return (
                      <Pressable
                        key={product.id}
                        onPress={() =>
                          router.push({
                            pathname: "/(root)/product/[id]",
                            params: { id: product.id },
                          } as any)
                        }
                        className="w-[47%] overflow-hidden rounded-3xl bg-card shadow-sm border border-border/50"
                      >
                        {/* Image */}
                        <View className="h-36 w-full overflow-hidden bg-neutral">
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              className="h-full w-full"
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="h-full w-full items-center justify-center bg-primary/10">
                              <Ionicons name="cube" size={32} color={colors.primary} />
                            </View>
                          )}
                          {product.isOrganic ? (
                            <View className="absolute left-2 top-2 flex-row items-center gap-0.5 rounded-full bg-severity-low-bg px-2 py-0.5 shadow-sm">
                              <Ionicons name="leaf" size={10} color="#027A48" />
                              <AppText
                                variant="caption"
                                style={{ color: "#027A48", fontSize: 10 }}
                                className="font-bengali-bold"
                              >
                                জৈব
                              </AppText>
                            </View>
                          ) : null}
                        </View>

                        {/* Details */}
                        <View className="gap-1 p-3">
                          <AppText
                            variant="body"
                            className="font-bengali-bold text-ink"
                            numberOfLines={1}
                          >
                            {product.name}
                          </AppText>
                          <AppText variant="body" className="font-bengali-bold text-primary">
                            {formatPriceBn(product.pricePerUnit, product.unit)}
                          </AppText>
                          <AppText variant="caption" className="text-muted" numberOfLines={1}>
                            মজুদ: {toBn(product.availableQuantity)} {formatUnitBn(product.unit)}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Add Product Modal for Shop Owner */}
      <AddProductModal
        visible={addProductModalVisible}
        onClose={() => setAddProductModalVisible(false)}
      />
    </SafeAreaView>
  );
}
