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
import { toBn } from "@/utils/marketFormatters";

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

  // Seller orders — fetched only to show a count badge on the tab
  const { data: shopOrders = [] } = useGetShopOrdersQuery();
  const pendingCount = shopOrders.filter((o: any) => o.status === "pending").length;

  // Kept for buyer cancel action
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

        {/* ── Seller tab: navigate to dedicated screen ── */}
        {tab === "seller" ? (
          <View className="gap-4">
            {/* Quick-navigate card */}
            <Pressable
              onPress={() => router.push("/(root)/seller-orders")}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm flex-row items-center gap-4"
              style={{ elevation: 2 }}
            >
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Ionicons name="storefront" size={28} color={colors.primary} />
              </View>
              <View className="flex-1">
                <AppText variant="subtitle" className="font-bengali-bold text-ink">
                  দোকানের অর্ডার ব্যবস্থাপনা
                </AppText>
                <AppText variant="caption" className="text-muted font-bengali-medium mt-0.5">
                  {shopOrders.length > 0
                    ? `মোট ${toBn(shopOrders.length)}টি অর্ডার`
                    : "অর্ডার দেখুন ও পরিচালনা করুন"}
                </AppText>
                {pendingCount > 0 ? (
                  <View className="mt-1.5 flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-full bg-amber-500" />
                    <AppText variant="caption" className="text-amber-600 font-bengali-semibold">
                      {toBn(pendingCount)}টি নতুন অর্ডার অপেক্ষমাণ
                    </AppText>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          </View>
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
