import { useState } from "react";
import { Image, Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  PrimaryButton,
  RetryCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { SingleShopCartModal } from "@/components/market/SingleShopCartModal";
import { getApiError, useAddItemMutation, useGetCartQuery, useGetProductQuery } from "@/services/api";
import {
  formatCategoryBn,
  formatDateBn,
  formatGradeBn,
  formatPriceBn,
  formatUnitBn,
  toBn,
} from "@/utils/marketFormatters";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [shopMismatchModalVisible, setShopMismatchModalVisible] = useState(false);

  const { data: cart } = useGetCartQuery();
  const cartItemCount = cart?.items?.length ?? 0;

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useGetProductQuery(id ?? "", { skip: !id });

  const [addToCart, { isLoading: addingToCart }] = useAddItemMutation();

  const handleAddToCart = async (clearPreviousCart = false) => {
    if (!product) return;
    try {
      await addToCart({
        productId: product.id,
        quantity: Math.max(quantity, product.minOrderQuantity ?? 1),
        clearPreviousCart,
      }).unwrap();
      setShopMismatchModalVisible(false);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    } catch (err: unknown) {
      const apiErr = getApiError(err);
      if (apiErr.code === "SHOP_MISMATCH" || apiErr.message?.includes("another shop")) {
        setShopMismatchModalVisible(true);
      }
    }
  };

  const handleCallSeller = () => {
    if (product?.shop?.phone) {
      void Linking.openURL(`tel:${product.shop.phone}`);
    }
  };

  const minQty = product?.minOrderQuantity ?? 1;

  const shopLocation = product?.shop
    ? [
        product.district?.nameBn ?? product.shop.district?.nameBn,
        product.shop.upazila,
        product.shop.address,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header Bar */}
      <View className="flex-row items-center justify-between border-b border-border bg-card px-5 py-3.5">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <AppText variant="subtitle" className="font-bengali-bold text-ink flex-1 text-center mx-2" numberOfLines={1}>
          {product?.name ?? "পণ্যের বিবরণ"}
        </AppText>
        <Pressable
          onPress={() => router.push("/(root)/cart")}
          className="relative h-10 w-10 items-center justify-center rounded-full bg-neutral"
        >
          <Ionicons name="cart-outline" size={20} color={colors.ink} />
          {cartItemCount > 0 ? (
            <View className="absolute -top-1 -right-1 h-5 min-w-5 items-center justify-center rounded-full bg-forest-700 px-1 border-2 border-white shadow-xs">
              <AppText
                variant="caption"
                className="font-bengali-bold text-white"
                style={{ fontSize: 10, lineHeight: 12 }}
              >
                {toBn(cartItemCount)}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-32"
        showsVerticalScrollIndicator={false}
      >
        {isError ? (
          <RetryCard
            message="পণ্যের বিবরণ লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।"
            onRetry={refetch}
          />
        ) : isLoading ? (
          <AIGeneratingShimmer label="পণ্যের তথ্য লোড হচ্ছে" lines={5} className="w-full" />
        ) : product ? (
          <>
            {/* Image Gallery */}
            <View className="gap-2">
              <View className="relative h-64 w-full rounded-3xl bg-card shadow-sm overflow-hidden border border-border/40">
                {product.images && product.images.length > 0 ? (
                  <Image
                    source={{ uri: product.images[selectedImageIndex]?.url ?? product.images[0].url }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-primary/10">
                    <Ionicons name="cube" size={48} color={colors.primary} />
                  </View>
                )}

                {/* Badges */}
                <View className="absolute left-4 top-4 flex-row flex-wrap gap-2">
                  {product.isOrganic ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-severity-low-bg px-3 py-1 shadow-sm">
                      <Ionicons name="leaf" size={14} color="#027A48" />
                      <AppText variant="caption" className="font-bengali-bold text-severity-low">
                        জৈব পণ্য
                      </AppText>
                    </View>
                  ) : null}
                  {product.grade ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-3 py-1 shadow-sm">
                      <Ionicons name="ribbon-outline" size={14} color={colors.primary} />
                      <AppText variant="caption" className="font-bengali-bold text-primary">
                        {formatGradeBn(product.grade)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Thumbnail Bar if multiple images */}
              {product.images && product.images.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  {product.images.map((img: any, idx: number) => {
                    const isSelected = idx === selectedImageIndex;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setSelectedImageIndex(idx)}
                        className={`h-16 w-16 overflow-hidden rounded-2xl border-2 ${
                          isSelected ? "border-primary" : "border-border"
                        }`}
                      >
                        <Image source={{ uri: img.url }} className="h-full w-full" resizeMode="cover" />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            {/* Title & Price Header */}
            <StructuredCard
              title={product.name}
              icon={<Ionicons name="pricetag" size={20} color={colors.primary} />}
            >
              <View className="gap-3">
                <View className="flex-row items-end justify-between flex-wrap gap-2">
                  <View className="flex-row items-end gap-1.5">
                    <AppText variant="hero" style={{ fontSize: 30, lineHeight: 36 }}>
                      {formatPriceBn(product.pricePerUnit, product.unit)}
                    </AppText>
                  </View>
                  <View className="rounded-full bg-primary/10 px-3 py-1">
                    <AppText variant="caption" className="font-bengali-bold text-primary">
                      মজুদ: {toBn(product.availableQuantity)} {formatUnitBn(product.unit)}
                    </AppText>
                  </View>
                </View>

                {minQty > 1 ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="alert-circle-outline" size={14} color={colors.muted} />
                    <AppText variant="caption" className="text-muted">
                      সর্বনিম্ন অর্ডার পরিমাণ: {toBn(minQty)} {formatUnitBn(product.unit)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </StructuredCard>

            {/* Additional Specs Card (Category, Harvest Date, Grade) */}
            <StructuredCard
              title="পণ্যের তথ্য"
              icon={<Ionicons name="information-circle" size={20} color={colors.primary} />}
            >
              <View className="gap-2.5">
                {product.category ? (
                  <View className="flex-row items-center justify-between border-b border-border/40 pb-2">
                    <AppText variant="caption" className="font-bengali-medium text-muted">
                      শ্রেণি
                    </AppText>
                    <AppText variant="body" className="font-bengali-bold text-ink">
                      {formatCategoryBn(product.category)}
                    </AppText>
                  </View>
                ) : null}

                {product.harvestDate ? (
                  <View className="flex-row items-center justify-between border-b border-border/40 pb-2">
                    <AppText variant="caption" className="font-bengali-medium text-muted">
                      ফসল সংগ্রহের তারিখ
                    </AppText>
                    <AppText variant="body" className="font-bengali-bold text-ink">
                      {formatDateBn(product.harvestDate)}
                    </AppText>
                  </View>
                ) : null}

                {product.grade ? (
                  <View className="flex-row items-center justify-between border-b border-border/40 pb-2">
                    <AppText variant="caption" className="font-bengali-medium text-muted">
                      মান / গ্রেড
                    </AppText>
                    <AppText variant="body" className="font-bengali-bold text-ink">
                      {formatGradeBn(product.grade)}
                    </AppText>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between">
                  <AppText variant="caption" className="font-bengali-medium text-muted">
                    জৈব/অর্গানিক
                  </AppText>
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    {product.isOrganic ? "হ্যাঁ (জৈব)" : "না"}
                  </AppText>
                </View>
              </View>
            </StructuredCard>

            {/* Description Card */}
            <StructuredCard
              title="পণ্যের বিবরণ"
              icon={<Ionicons name="document-text" size={20} color={colors.primary} />}
            >
              <AppText variant="body" className="font-bengali-medium text-ink leading-relaxed">
                {product.description}
              </AppText>
            </StructuredCard>

            {/* Seller & Shop Info Card */}
            {product.shop ? (
              <StructuredCard
                title="বিক্রেতার দোকান"
                icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
                footer={
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <SecondaryButton
                        label="দোকানে যান"
                        onPress={() =>
                          router.push({
                            pathname: "/(root)/shop/[id]",
                            params: { id: product.shop.id },
                          } as any)
                        }
                        icon={<Ionicons name="open-outline" size={18} color={colors.ink} />}
                      />
                    </View>
                    <View className="flex-1">
                      <PrimaryButton
                        label="কল করুন"
                        onPress={handleCallSeller}
                        icon={<Ionicons name="call" size={18} color={colors.white} />}
                      />
                    </View>
                  </View>
                }
              >
                <View className="flex-row items-center gap-3">
                  {product.shop.logoUrl ? (
                    <Image
                      source={{ uri: product.shop.logoUrl }}
                      className="h-14 w-14 rounded-2xl bg-neutral"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Ionicons name="storefront" size={24} color={colors.primary} />
                    </View>
                  )}
                  <View className="flex-1">
                    <AppText variant="subtitle" className="font-bengali-bold text-ink">
                      {product.shop.name}
                    </AppText>
                    {product.shop.owner?.displayName ? (
                      <AppText variant="caption" className="text-muted mt-0.5 font-bengali-medium">
                        বিক্রেতা: {product.shop.owner.displayName}
                      </AppText>
                    ) : null}
                    {shopLocation ? (
                      <AppText variant="caption" className="text-muted mt-0.5 font-bengali-medium">
                        📍 {shopLocation}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              </StructuredCard>
            ) : null}

            {/* Ratings & Reviews */}
            <StructuredCard
              title={`রিভিউ ও রেটিং (${toBn(product.reviewCount ?? 0)})`}
              icon={<Ionicons name="star" size={20} color="#F59E0B" />}
            >
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="star" size={24} color="#F59E0B" />
                  <AppText variant="title" className="font-bengali-bold text-ink">
                    {product.avgRating ? toBn(product.avgRating.toFixed(1)) : "০.০"}
                  </AppText>
                  <AppText variant="caption" className="text-muted">
                    / ৫ (মোট {toBn(product.reviewCount ?? 0)}টি রিভিউ)
                  </AppText>
                </View>

                {product.reviews && product.reviews.length > 0 ? (
                  <View className="gap-2">
                    {product.reviews.map((rev: any) => (
                      <View key={rev.id} className="rounded-2xl bg-neutral p-3 gap-1">
                        <View className="flex-row items-center justify-between">
                          <AppText variant="caption" className="font-bengali-bold text-ink">
                            {rev.user?.displayName ?? "ক্রেতা"}
                          </AppText>
                          <View className="flex-row items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name="star"
                                size={12}
                                color={star <= rev.rating ? "#F59E0B" : colors.border}
                              />
                            ))}
                          </View>
                        </View>
                        {rev.comment ? (
                          <AppText variant="caption" className="text-ink font-bengali-medium mt-0.5">
                            {rev.comment}
                          </AppText>
                        ) : null}
                        {rev.createdAt ? (
                          <AppText variant="caption" className="text-muted font-bengali-medium mt-1">
                            {formatDateBn(rev.createdAt)}
                          </AppText>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <AppText variant="caption" className="text-muted">
                    এই পণ্যে এখনো কোনো রিভিউ নেই।
                  </AppText>
                )}
              </View>
            </StructuredCard>
          </>
        ) : null}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      {product ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-5 py-4 shadow-lg flex-row items-center gap-3">
          {/* Quantity Controls */}
          <View className="flex-row items-center rounded-2xl bg-neutral px-2 py-1 border border-border">
            <Pressable
              onPress={() => setQuantity((q) => Math.max(minQty, q - 1))}
              className="h-9 w-9 items-center justify-center rounded-xl bg-card shadow-xs"
            >
              <Ionicons name="remove" size={18} color={colors.ink} />
            </Pressable>
            <AppText variant="body" className="mx-3 font-bengali-bold text-ink">
              {toBn(quantity)}
            </AppText>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(product.availableQuantity, q + 1))}
              className="h-9 w-9 items-center justify-center rounded-xl bg-card shadow-xs"
            >
              <Ionicons name="add" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <View className="flex-1">
            <PrimaryButton
              label={addedSuccess ? "কার্টে যোগ হয়েছে!" : "কার্টে যোগ করুন"}
              onPress={() => handleAddToCart()}
              loading={addingToCart}
              disabled={product.availableQuantity <= 0}
              icon={<Ionicons name="cart" size={20} color={colors.white} />}
            />
          </View>
        </View>
      ) : null}

      <SingleShopCartModal
        visible={shopMismatchModalVisible}
        onClose={() => setShopMismatchModalVisible(false)}
        onConfirmClearAndAdd={() => handleAddToCart(true)}
        loading={addingToCart}
      />
    </SafeAreaView>
  );
}
