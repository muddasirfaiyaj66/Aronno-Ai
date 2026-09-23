import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  PrimaryButton,
  RetryCard,
  SecondaryButton,
  SegmentedTabs,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { ReviewModal } from "@/components/market/ReviewModal";
import {
  useGetBuyerOrdersQuery,
  useGetShopOrdersQuery,
  useUpdateOrderStatusMutation,
} from "@/services/api";

type OrderTab = "buyer" | "seller";

const TABS: { id: OrderTab; label: string }[] = [
  { id: "buyer", label: "আমার কেনাকাটা" },
  { id: "seller", label: "দোকানের বিক্রি" },
];

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "অপেক্ষমাণ", color: "#B54708", bg: "#FEF0C7" },
  confirmed: { label: "নিশ্চিত করা হয়েছে", color: "#026AA2", bg: "#E0F2FE" },
  processing: { label: "প্রক্রিয়াধীন", color: "#5925DC", bg: "#F4F3FF" },
  shipped: { label: "পাঠানো হয়েছে", color: "#175CD3", bg: "#EFF8FF" },
  delivered: { label: "পৌঁছেছে", color: "#027A48", bg: "#ECFDF3" },
  cancelled: { label: "বাতিল করা হয়েছে", color: "#B42318", bg: "#FEF3F2" },
};

export default function OrdersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<OrderTab>("buyer");

  // Review Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    orderId: string;
    productId: string;
    productName: string;
  } | null>(null);

  const {
    data: buyerOrders = [],
    isLoading: buyerLoading,
    isError: buyerError,
    refetch: refetchBuyer,
  } = useGetBuyerOrdersQuery();

  const {
    data: shopOrders = [],
    isLoading: sellerLoading,
    isError: sellerError,
    refetch: refetchSeller,
  } = useGetShopOrdersQuery();

  const [updateStatus, { isLoading: updatingStatus }] = useUpdateOrderStatusMutation();

  const openReviewModal = (orderId: string, productId: string, productName: string) => {
    setReviewTarget({ orderId, productId, productName });
    setReviewModalVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header Bar */}
      <View className="border-b border-border bg-white px-5 py-3.5">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <AppText variant="subtitle" className="font-bengali-bold text-ink">
              অর্ডার ও বেচাকেনা
            </AppText>
            <AppText variant="caption" className="text-muted">
              কেনাকাটা ও বিক্রির স্ট্যাটাস ট্র্যাক করুন
            </AppText>
          </View>
        </View>

        <SegmentedTabs className="mt-3" options={TABS} value={tab} onChange={setTab} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {tab === "buyer" ? (
          buyerError ? (
            <RetryCard message="অর্ডারের তথ্য লোড করা যায়নি।" onRetry={refetchBuyer} />
          ) : buyerLoading ? (
            <AIGeneratingShimmer label="অর্ডার লোড হচ্ছে" lines={3} className="w-full" />
          ) : buyerOrders.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="bag-handle-outline" size={40} color={colors.primary} />}
              message="আপনার এখনো কোনো অর্ডারের ইতিহাস নেই।"
              ctaLabel="বাজার দেখুন"
              onCta={() => router.push("/(root)/(tabs)/market")}
            />
          ) : (
            buyerOrders.map((order) => {
              const statusInfo = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending;

              return (
                <StructuredCard
                  key={order.id}
                  title={order.shop?.name ?? "দোকান"}
                  icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
                  footer={
                    order.status === "pending" ? (
                      <SecondaryButton
                        label="অর্ডার বাতিল করুন"
                        onPress={() => updateStatus({ id: order.id, status: "cancelled" })}
                        loading={updatingStatus}
                        icon={<Ionicons name="close-circle-outline" size={18} color="#D92D20" />}
                      />
                    ) : undefined
                  }
                >
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <AppText variant="caption" className="font-bengali-semibold text-muted">
                        অর্ডার নং: #{order.orderNumber}
                      </AppText>
                      <View className="rounded-full px-3 py-1" style={{ backgroundColor: statusInfo.bg }}>
                        <AppText variant="caption" className="font-bengali-bold" style={{ color: statusInfo.color }}>
                          {statusInfo.label}
                        </AppText>
                      </View>
                    </View>

                    {/* Line Items */}
                    <View className="gap-2 border-t border-b border-border/50 py-2">
                      {order.items.map((item: any, i: number) => (
                        <View key={i} className="flex-row items-center justify-between">
                          <View className="flex-1 pr-2">
                            <AppText variant="body" className="font-bengali-semibold text-ink">
                              {item.productName} ({item.quantity} {item.unit})
                            </AppText>
                          </View>
                          <AppText variant="body" className="font-bengali-bold text-ink">
                            ৳ {item.totalPrice}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    <View className="flex-row items-center justify-between">
                      <AppText variant="caption" className="text-muted">
                        মোট পরিশোধযোগ্য
                      </AppText>
                      <AppText variant="subtitle" className="font-bengali-bold text-primary">
                        ৳ {order.totalBdt}
                      </AppText>
                    </View>

                    {/* Write Review option for delivered items */}
                    {order.status === "delivered" && order.items.length > 0 ? (
                      <View className="pt-1">
                        <SecondaryButton
                          label="পণ্যটির রিভিউ দিন"
                          onPress={() => openReviewModal(order.id, order.items[0].productId, order.items[0].productName)}
                          icon={<Ionicons name="star-outline" size={16} color={colors.ink} />}
                        />
                      </View>
                    ) : null}
                  </View>
                </StructuredCard>
              );
            })
          )
        ) : null}

        {tab === "seller" ? (
          sellerError ? (
            <RetryCard message="বিক্রির তথ্য লোড করা যায়নি। আপনি কি দোকান তৈরি করেছেন?" onRetry={refetchSeller} />
          ) : sellerLoading ? (
            <AIGeneratingShimmer label="বিক্রির তথ্য লোড হচ্ছে" lines={3} className="w-full" />
          ) : shopOrders.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="cube-outline" size={40} color={colors.primary} />}
              message="আপনার দোকানে এখনো কোনো কাস্টমার অর্ডার আসেনি।"
              ctaLabel="রিফ্রেশ করুন"
              onCta={refetchSeller}
            />
          ) : (
            shopOrders.map((order) => {
              const statusInfo = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending;

              return (
                <StructuredCard
                  key={order.id}
                  title={`ক্রেতা: ${order.buyer?.displayName ?? "কাস্টমার"}`}
                  icon={<Ionicons name="person" size={20} color={colors.primary} />}
                >
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <AppText variant="caption" className="font-bengali-semibold text-muted">
                        অর্ডার নং: #{order.orderNumber}
                      </AppText>
                      <View className="rounded-full px-3 py-1" style={{ backgroundColor: statusInfo.bg }}>
                        <AppText variant="caption" className="font-bengali-bold" style={{ color: statusInfo.color }}>
                          {statusInfo.label}
                        </AppText>
                      </View>
                    </View>

                    <AppText variant="caption" className="text-muted">
                      📍 ঠিকানা: {order.shippingAddress} · 📞 {order.contactPhone}
                    </AppText>

                    {/* Order Line Items */}
                    <View className="gap-2 border-t border-b border-border/50 py-2">
                      {order.items.map((item: any, i: number) => (
                        <View key={i} className="flex-row items-center justify-between">
                          <AppText variant="body" className="font-bengali-semibold text-ink flex-1 pr-2">
                            {item.productName} ({item.quantity} {item.unit})
                          </AppText>
                          <AppText variant="body" className="font-bengali-bold text-ink">
                            ৳ {item.totalPrice}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    <View className="flex-row items-center justify-between">
                      <AppText variant="caption" className="text-muted">
                        মোট বিল
                      </AppText>
                      <AppText variant="subtitle" className="font-bengali-bold text-primary">
                        ৳ {order.totalBdt}
                      </AppText>
                    </View>

                    {/* Status Update Actions for Seller */}
                    {order.status !== "delivered" && order.status !== "cancelled" ? (
                      <View className="gap-2 pt-2 border-t border-border/50">
                        <AppText variant="caption" className="font-bengali-semibold text-ink">
                          অর্ডারের স্ট্যাটাস পরিবর্তন করুন:
                        </AppText>
                        <View className="flex-row flex-wrap gap-2">
                          {order.status === "pending" ? (
                            <PrimaryButton
                              label="নিশ্চিত করুন"
                              onPress={() => updateStatus({ id: order.id, status: "confirmed" })}
                              loading={updatingStatus}
                            />
                          ) : null}
                          {order.status === "confirmed" ? (
                            <PrimaryButton
                              label="প্রক্রিয়াধীন করুন"
                              onPress={() => updateStatus({ id: order.id, status: "processing" })}
                              loading={updatingStatus}
                            />
                          ) : null}
                          {order.status === "processing" ? (
                            <PrimaryButton
                              label="পাঠানো হয়েছে (Shipped)"
                              onPress={() => updateStatus({ id: order.id, status: "shipped" })}
                              loading={updatingStatus}
                            />
                          ) : null}
                          {order.status === "shipped" ? (
                            <PrimaryButton
                              label="পৌঁছেছে (Delivered)"
                              onPress={() => updateStatus({ id: order.id, status: "delivered" })}
                              loading={updatingStatus}
                            />
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </StructuredCard>
              );
            })
          )
        ) : null}
      </ScrollView>

      {/* Review Modal */}
      {reviewTarget ? (
        <ReviewModal
          visible={reviewModalVisible}
          onClose={() => {
            setReviewModalVisible(false);
            setReviewTarget(null);
          }}
          orderId={reviewTarget.orderId}
          productId={reviewTarget.productId}
          productName={reviewTarget.productName}
        />
      ) : null}
    </SafeAreaView>
  );
}
