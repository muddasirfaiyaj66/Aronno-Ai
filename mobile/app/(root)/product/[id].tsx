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
import { useAddItemMutation, useGetProductQuery } from "@/services/api";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useGetProductQuery(id ?? "", { skip: !id });

  const [addToCart, { isLoading: addingToCart }] = useAddItemMutation();

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      await addToCart({
        productId: product.id,
        quantity: Math.max(quantity, product.minOrderQuantity ?? 1),
      }).unwrap();
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    } catch {
      // Error handling
    }
  };

  const handleCallSeller = () => {
    if (product?.shop?.phone) {
      void Linking.openURL(`tel:${product.shop.phone}`);
    }
  };

  const minQty = product?.minOrderQuantity ?? 1;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header Bar */}
      <View className="flex-row items-center justify-between border-b border-border bg-white px-5 py-3.5">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <AppText variant="subtitle" className="font-bengali-bold text-ink" numberOfLines={1}>
          {product?.name ?? "পণ্যের বিবরণ"}
        </AppText>
        <Pressable
          onPress={() => router.push("/(root)/cart")}
          className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
        >
          <Ionicons name="cart-outline" size={20} color={colors.ink} />
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
            {/* Image Preview */}
            <View className="relative h-64 w-full rounded-3xl bg-white shadow-sm overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <Image
                  source={{ uri: product.images[0].url }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-full w-full items-center justify-center bg-primary/10">
                  <Ionicons name="cube" size={48} color={colors.primary} />
                </View>
              )}

              {product.isOrganic ? (
                <View className="absolute left-4 top-4 flex-row items-center gap-1 rounded-full bg-severity-low-bg px-3 py-1 shadow-sm">
                  <Ionicons name="leaf" size={14} color="#027A48" />
                  <AppText variant="caption" className="font-bengali-bold text-severity-low">
                    জৈব / অর্গানিক
                  </AppText>
                </View>
              ) : null}
            </View>

            {/* Title & Price Header */}
            <StructuredCard
              title={product.name}
              icon={<Ionicons name="pricetag" size={20} color={colors.primary} />}
            >
              <View className="gap-2">
                <View className="flex-row items-end justify-between">
                  <View className="flex-row items-end gap-1.5">
                    <AppText variant="hero" style={{ fontSize: 32, lineHeight: 38 }}>
                      ৳ {product.pricePerUnit}
                    </AppText>
                    <AppText variant="body" className="mb-1 text-muted">
                      /{product.unit}
                    </AppText>
                  </View>
                  <View className="rounded-full bg-primary/10 px-3 py-1">
                    <AppText variant="caption" className="font-bengali-bold text-primary">
                      মজুদ: {product.availableQuantity} {product.unit}
                    </AppText>
                  </View>
                </View>

                {minQty > 1 ? (
                  <AppText variant="caption" className="text-muted">
                    সর্বনিম্ন অর্ডার: {minQty} {product.unit}
                  </AppText>
                ) : null}
              </View>
            </StructuredCard>

            {/* Description Card */}
            <StructuredCard
              title="পণ্যের বিবরণ"
              icon={<Ionicons name="document-text" size={20} color={colors.primary} />}
            >
              <AppText variant="body" className="font-bengali-medium text-ink">
                {product.description}
              </AppText>
            </StructuredCard>

            {/* Seller Shop Info Card */}
            {product.shop ? (
              <StructuredCard
                title="বিক্রেতার দোকান"
                icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
                footer={
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <SecondaryButton
                        label="দোকানে যান"
                        onPress={() => router.push({ pathname: "/(root)/shop/[id]", params: { id: product.shop.id } })}
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
                    {product.shop.owner ? (
                      <AppText variant="caption" className="text-muted mt-0.5">
                        বিক্রেতা: {product.shop.owner.displayName}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              </StructuredCard>
            ) : null}

            {/* Ratings & Reviews */}
            <StructuredCard
              title={`রিভিউ ও রেটিং (${product.reviewCount ?? 0})`}
              icon={<Ionicons name="star" size={20} color="#F59E0B" />}
            >
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="star" size={24} color="#F59E0B" />
                  <AppText variant="title" className="font-bengali-bold text-ink">
                    {product.avgRating ? product.avgRating.toFixed(1) : "০.০"}
                  </AppText>
                  <AppText variant="caption" className="text-muted">
                    / ৫ (মোট {product.reviewCount ?? 0}টি রিভিউ)
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
                          <AppText variant="caption" className="text-ink">
                            {rev.comment}
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
        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white px-5 py-4 shadow-lg flex-row items-center gap-3">
          {/* Quantity Controls */}
          <View className="flex-row items-center rounded-2xl bg-neutral px-2 py-1">
            <Pressable
              onPress={() => setQuantity((q) => Math.max(minQty, q - 1))}
              className="h-9 w-9 items-center justify-center rounded-xl bg-white"
            >
              <Ionicons name="remove" size={18} color={colors.ink} />
            </Pressable>
            <AppText variant="body" className="mx-3 font-bengali-bold text-ink">
              {quantity}
            </AppText>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(product.availableQuantity, q + 1))}
              className="h-9 w-9 items-center justify-center rounded-xl bg-white"
            >
              <Ionicons name="add" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <View className="flex-1">
            <PrimaryButton
              label={addedSuccess ? "কার্টে যোগ হয়েছে!" : "কার্টে যোগ করুন"}
              onPress={handleAddToCart}
              loading={addingToCart}
              disabled={product.availableQuantity <= 0}
              icon={<Ionicons name="cart" size={20} color={colors.white} />}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
