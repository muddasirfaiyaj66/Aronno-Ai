import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  PrimaryButton,
  RetryCard,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useClearCartMutation,
  useGetCartQuery,
  useRemoveItemMutation,
  useUpdateQuantityMutation,
} from "@/services/api";
import {
  formatPriceBn,
  formatUnitBn,
  toBn,
} from "@/utils/marketFormatters";

export default function CartScreen() {
  const router = useRouter();
  const { data: cart, isLoading, isError, refetch } = useGetCartQuery();

  const [updateQuantity] = useUpdateQuantityMutation();
  const [removeItem] = useRemoveItemMutation();
  const [clearCart, { isLoading: clearing }] = useClearCartMutation();

  const cartItems = cart?.items ?? [];
  const shopName = cart?.shopName ?? "";
  const totalBdt = cart?.totalBdt ?? 0;

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

        <AppText variant="subtitle" className="font-bengali-bold text-ink">
          আমার কার্ট
        </AppText>

        {cartItems.length > 0 ? (
          <Pressable onPress={() => clearCart()} disabled={clearing}>
            <AppText variant="caption" className="font-bengali-bold text-red-600">
              কার্ট খালি করুন
            </AppText>
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-32"
        showsVerticalScrollIndicator={false}
      >
        {isError ? (
          <RetryCard
            message="কার্টের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।"
            onRetry={refetch}
          />
        ) : isLoading ? (
          <AIGeneratingShimmer label="কার্ট লোড হচ্ছে" lines={3} className="w-full" />
        ) : cartItems.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="cart-outline" size={40} color={colors.primary} />}
            message="আপনার কার্ট খালি রয়েছে।"
            ctaLabel="পণ্য ব্রাউজ করুন"
            onCta={() => router.push("/(root)/(tabs)/market")}
          />
        ) : (
          <StructuredCard
            title={shopName || "দোকানের পণ্যসামগ্রী"}
            icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
          >
            <View className="gap-3">
              {cartItems.map((item: any) => {
                const isAtMaxStock = item.quantity >= item.availableQuantity;
                const minQty = item.minOrderQuantity ?? 1;

                return (
                  <View
                    key={item.productId}
                    className="flex-row items-center justify-between border-b border-border/50 pb-3.5 pt-1"
                  >
                    {/* Item Thumbnail */}
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        className="h-16 w-16 rounded-2xl bg-neutral border border-border/40 mr-3"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mr-3">
                        <Ionicons name="cube" size={24} color={colors.primary} />
                      </View>
                    )}

                    {/* Item Details */}
                    <View className="flex-1 pr-2 gap-0.5">
                      <AppText variant="body" className="font-bengali-bold text-ink" numberOfLines={1}>
                        {item.productName}
                      </AppText>

                      <AppText variant="caption" className="text-muted font-bengali-medium">
                        {formatPriceBn(item.pricePerUnit, item.unit)}
                      </AppText>

                      <AppText variant="caption" className="font-bengali-semibold text-primary mt-0.5">
                        মোট: {formatPriceBn(item.totalPrice)}
                      </AppText>

                      {isAtMaxStock ? (
                        <AppText variant="caption" className="text-amber-600 font-bengali-medium" style={{ fontSize: 10 }}>
                          সর্বোচ্চ মজুদ সীমা পৌঁছানো হয়েছে
                        </AppText>
                      ) : null}
                    </View>

                    {/* Quantity & Remove Controls */}
                    <View className="flex-row items-center gap-2">
                      <View className="flex-row items-center rounded-xl bg-neutral px-1.5 py-1 border border-border/60">
                        <Pressable
                          onPress={() => {
                            if (item.quantity <= minQty) {
                              removeItem(item.productId);
                            } else {
                              updateQuantity({
                                productId: item.productId,
                                quantity: item.quantity - 1,
                              });
                            }
                          }}
                          className="h-7 w-7 items-center justify-center rounded-lg bg-white shadow-xs"
                        >
                          <Ionicons
                            name={item.quantity <= minQty ? "trash-outline" : "remove"}
                            size={14}
                            color={item.quantity <= minQty ? "#D92D20" : colors.ink}
                          />
                        </Pressable>

                        <AppText variant="caption" className="mx-2 font-bengali-bold text-ink">
                          {toBn(item.quantity)}
                        </AppText>

                        <Pressable
                          disabled={isAtMaxStock}
                          onPress={() =>
                            updateQuantity({
                              productId: item.productId,
                              quantity: Math.min(item.availableQuantity, item.quantity + 1),
                            })
                          }
                          className={`h-7 w-7 items-center justify-center rounded-lg ${
                            isAtMaxStock ? "bg-neutral opacity-50" : "bg-white shadow-xs"
                          }`}
                        >
                          <Ionicons
                            name="add"
                            size={14}
                            color={isAtMaxStock ? colors.muted : colors.ink}
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => removeItem(item.productId)}
                        className="h-8 w-8 items-center justify-center rounded-full bg-red-50"
                      >
                        <Ionicons name="trash-outline" size={16} color="#D92D20" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </StructuredCard>
        )}
      </ScrollView>

      {/* Bottom Sticky Total & Checkout Bar */}
      {cartItems.length > 0 ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white px-5 py-4 shadow-lg gap-3">
          <View className="flex-row items-center justify-between">
            <AppText variant="body" className="font-bengali-medium text-muted">
              মোট ({toBn(cartItems.length)}টি পণ্য)
            </AppText>
            <AppText variant="hero" style={{ fontSize: 26, lineHeight: 30 }} className="text-primary font-bengali-bold">
              {formatPriceBn(totalBdt)}
            </AppText>
          </View>

          <PrimaryButton
            label="অর্ডার করতে এগিয়ে যান"
            onPress={() => {
              // Checkout flow will be handled in order sprint
            }}
            icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
