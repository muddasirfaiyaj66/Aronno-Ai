import { useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  RetryCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useGetShopOrdersQuery,
  useUpdateOrderStatusMutation,
} from "@/services/api";
import { formatPriceBn, formatUnitBn, toBn } from "@/utils/marketFormatters";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: {
    label: "নতুন অর্ডার",
    color: "#B54708",
    bg: "#FEF0C7",
    icon: "time-outline",
  },
  confirmed: {
    label: "নিশ্চিত",
    color: "#026AA2",
    bg: "#E0F2FE",
    icon: "checkmark-circle-outline",
  },
  processing: {
    label: "প্রস্তুত হচ্ছে",
    color: "#5925DC",
    bg: "#F4F3FF",
    icon: "construct-outline",
  },
  shipped: {
    label: "পাঠানো হয়েছে",
    color: "#175CD3",
    bg: "#EFF8FF",
    icon: "bicycle-outline",
  },
  delivered: {
    label: "ডেলিভারি সম্পন্ন",
    color: "#027A48",
    bg: "#ECFDF3",
    icon: "checkmark-done-circle-outline",
  },
  cancelled: {
    label: "বাতিল",
    color: "#B42318",
    bg: "#FEF3F2",
    icon: "close-circle-outline",
  },
};

// State machine — same as backend
const SELLER_TRANSITIONS: Record<
  string,
  { nextStatus: string; label: string; icon: string; danger?: boolean }[]
> = {
  pending: [
    { nextStatus: "confirmed", label: "অর্ডার গ্রহণ করুন", icon: "checkmark-circle" },
    {
      nextStatus: "cancelled",
      label: "অর্ডার বাতিল করুন",
      icon: "close-circle",
      danger: true,
    },
  ],
  confirmed: [
    {
      nextStatus: "processing",
      label: "প্রস্তুত করা শুরু করুন",
      icon: "construct",
    },
    {
      nextStatus: "cancelled",
      label: "অর্ডার বাতিল করুন",
      icon: "close-circle",
      danger: true,
    },
  ],
  processing: [
    {
      nextStatus: "shipped",
      label: "পাঠিয়ে দিয়েছি",
      icon: "bicycle",
    },
  ],
  shipped: [
    {
      nextStatus: "delivered",
      label: "ডেলিভারি সম্পন্ন হয়েছে",
      icon: "checkmark-done-circle",
    },
  ],
  delivered: [],
  cancelled: [],
};

// Filter tabs
const STATUS_TABS: { id: string; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "pending", label: "নতুন" },
  { id: "confirmed", label: "নিশ্চিত" },
  { id: "processing", label: "প্রস্তুত হচ্ছে" },
  { id: "shipped", label: "পাঠানো হয়েছে" },
  { id: "delivered", label: "সম্পন্ন" },
  { id: "cancelled", label: "বাতিল" },
];

// ─── Payment method label ─────────────────────────────────────────────────────
const PAYMENT_LABEL: Record<string, string> = {
  cash_on_delivery: "ক্যাশ অন ডেলিভারি",
  paid: "পরিশোধিত",
  pending: "অপেক্ষমাণ",
  failed: "ব্যর্থ",
};

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onUpdateStatus,
  updating,
}: {
  order: any;
  onUpdateStatus: (id: string, status: string) => void;
  updating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusMeta = STATUS_META[order.status] ?? STATUS_META.pending;
  const transitions = SELLER_TRANSITIONS[order.status] ?? [];
  const items: any[] = order.items ?? [];

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <View
      className="rounded-2xl border border-border bg-white overflow-hidden shadow-sm"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Status strip */}
      <View
        style={{ backgroundColor: statusMeta.bg }}
        className="px-4 py-2.5 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons
            name={statusMeta.icon as any}
            size={16}
            color={statusMeta.color}
          />
          <AppText
            variant="caption"
            className="font-bengali-bold"
            style={{ color: statusMeta.color }}
          >
            {statusMeta.label}
          </AppText>
        </View>
        <AppText
          variant="caption"
          className="text-muted font-bengali-medium"
          style={{ fontSize: 11 }}
        >
          {orderDate}
        </AppText>
      </View>

      <View className="px-4 pt-3 pb-4 gap-3">
        {/* Order number + buyer */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <AppText variant="caption" className="text-muted font-bengali-medium">
              অর্ডার নং
            </AppText>
            <AppText variant="body" className="font-bengali-bold text-ink">
              #{order.orderNumber}
            </AppText>
          </View>
          <View className="items-end">
            <AppText
              variant="subtitle"
              className="font-bengali-bold text-primary"
              style={{ fontSize: 18 }}
            >
              {formatPriceBn(order.totalBdt)}
            </AppText>
            <AppText variant="caption" className="text-muted font-bengali-medium">
              {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </AppText>
          </View>
        </View>

        {/* Buyer info */}
        <View className="flex-row items-center gap-3 rounded-xl bg-neutral px-3 py-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            {order.buyer?.avatarUrl ? (
              <Image
                source={{ uri: order.buyer.avatarUrl }}
                className="h-9 w-9 rounded-full"
              />
            ) : (
              <Ionicons name="person" size={18} color={colors.primary} />
            )}
          </View>
          <View className="flex-1">
            <AppText variant="body" className="font-bengali-bold text-ink">
              {order.buyer?.displayName ?? "ক্রেতা"}
            </AppText>
            {order.buyer?.phone || order.contactPhone ? (
              <AppText
                variant="caption"
                className="text-muted font-bengali-medium"
              >
                📞 {order.contactPhone ?? order.buyer?.phone}
              </AppText>
            ) : null}
          </View>
        </View>

        {/* Delivery address (collapsed preview) */}
        <View className="flex-row items-start gap-2">
          <Ionicons name="location-outline" size={14} color={colors.muted} style={{ marginTop: 2 }} />
          <AppText
            variant="caption"
            className="text-muted font-bengali-medium flex-1"
            numberOfLines={expanded ? undefined : 2}
          >
            {order.shippingAddress}
            {order.district?.nameBn ? ` · ${order.district.nameBn}` : ""}
          </AppText>
        </View>

        {/* Products preview or full list */}
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          className="border-t border-border/50 pt-3"
        >
          <View className="flex-row items-center justify-between mb-2">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              পণ্যসমূহ ({toBn(items.length)}টি)
            </AppText>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.muted}
            />
          </View>

          {(expanded ? items : items.slice(0, 2)).map((item: any, i: number) => (
            <View
              key={i}
              className="flex-row items-center justify-between py-1.5"
            >
              <AppText
                variant="body"
                className="font-bengali-semibold text-ink flex-1 pr-2"
                numberOfLines={1}
              >
                {item.productName}
              </AppText>
              <AppText
                variant="caption"
                className="text-muted font-bengali-medium mr-3"
              >
                {toBn(item.quantity)} {formatUnitBn(item.unit)}
              </AppText>
              <AppText variant="body" className="font-bengali-bold text-ink">
                {formatPriceBn(item.totalPrice)}
              </AppText>
            </View>
          ))}

          {!expanded && items.length > 2 ? (
            <AppText
              variant="caption"
              className="text-primary font-bengali-medium mt-1"
            >
              + আরও {toBn(items.length - 2)}টি পণ্য দেখতে ট্যাপ করুন
            </AppText>
          ) : null}
        </Pressable>

        {/* Price breakdown (shown when expanded) */}
        {expanded ? (
          <View className="border-t border-border/50 pt-2 gap-1.5">
            <View className="flex-row justify-between">
              <AppText variant="caption" className="text-muted font-bengali-medium">
                পণ্যের মূল্য
              </AppText>
              <AppText variant="caption" className="font-bengali-semibold text-ink">
                {formatPriceBn(order.subtotalBdt)}
              </AppText>
            </View>
            <View className="flex-row justify-between">
              <AppText variant="caption" className="text-muted font-bengali-medium">
                ডেলিভারি চার্জ
              </AppText>
              <AppText variant="caption" className="font-bengali-semibold text-ink">
                {formatPriceBn(order.deliveryFeeBdt)}
              </AppText>
            </View>
            <View className="flex-row justify-between border-t border-border/50 pt-1.5 mt-0.5">
              <AppText variant="body" className="font-bengali-bold text-ink">
                সর্বমোট
              </AppText>
              <AppText variant="body" className="font-bengali-bold text-primary">
                {formatPriceBn(order.totalBdt)}
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Action buttons — state machine driven */}
        {transitions.length > 0 ? (
          <View className="border-t border-border/50 pt-3 gap-2">
            <AppText
              variant="caption"
              className="font-bengali-semibold text-ink"
            >
              স্ট্যাটাস পরিবর্তন করুন:
            </AppText>
            <View className="flex-row flex-wrap gap-2">
              {transitions.map((t) => (
                <Pressable
                  key={t.nextStatus}
                  onPress={() => onUpdateStatus(order.id, t.nextStatus)}
                  disabled={updating}
                  className={`flex-row items-center gap-2 rounded-xl px-4 py-2.5 ${
                    t.danger
                      ? "bg-red-50 border border-red-200"
                      : "bg-primary border border-primary"
                  }`}
                  style={{ opacity: updating ? 0.6 : 1 }}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={16}
                    color={t.danger ? "#B42318" : "#fff"}
                  />
                  <AppText
                    variant="caption"
                    className={`font-bengali-bold ${t.danger ? "text-red-700" : "text-white"}`}
                  >
                    {t.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View className="border-t border-border/50 pt-3 flex-row items-center gap-2">
            <Ionicons
              name={statusMeta.icon as any}
              size={16}
              color={statusMeta.color}
            />
            <AppText
              variant="caption"
              className="font-bengali-medium"
              style={{ color: statusMeta.color }}
            >
              {order.status === "delivered"
                ? "এই অর্ডারটি সম্পন্ন হয়েছে।"
                : "এই অর্ডারটি বাতিল করা হয়েছে।"}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SellerOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const {
    data: allOrders = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetShopOrdersQuery();

  const [updateStatus] = useUpdateOrderStatusMutation();

  const filteredOrders =
    activeTab === "all"
      ? allOrders
      : allOrders.filter((o: any) => o.status === activeTab);

  // Count badges for each tab
  const countByStatus = allOrders.reduce(
    (acc: Record<string, number>, o: any) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await updateStatus({ id: orderId, status }).unwrap();
    } catch {
      // error handled via RTK mutation state
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header */}
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
              দোকানের অর্ডারসমূহ
            </AppText>
            <AppText variant="caption" className="text-muted font-bengali-medium">
              মোট {toBn(allOrders.length)}টি অর্ডার
            </AppText>
          </View>
          <Pressable
            onPress={() => refetch()}
            className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
          >
            <Ionicons
              name="refresh"
              size={20}
              color={isFetching ? colors.primary : colors.muted}
            />
          </Pressable>
        </View>
      </View>

      {/* Status filter tabs */}
      <View className="bg-white border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 py-2.5 gap-2"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count =
              tab.id === "all"
                ? allOrders.length
                : (countByStatus[tab.id] ?? 0);

            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 border ${
                  isActive
                    ? "bg-primary border-primary"
                    : "bg-white border-border"
                }`}
              >
                <AppText
                  variant="caption"
                  className={`font-bengali-semibold ${isActive ? "text-white" : "text-ink"}`}
                >
                  {tab.label}
                </AppText>
                {count > 0 ? (
                  <View
                    className={`h-5 min-w-5 items-center justify-center rounded-full px-1 ${
                      isActive ? "bg-white/25" : "bg-primary/10"
                    }`}
                  >
                    <AppText
                      variant="caption"
                      style={{ fontSize: 10 }}
                      className={`font-bengali-bold ${isActive ? "text-white" : "text-primary"}`}
                    >
                      {toBn(count)}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {isError ? (
        <View className="flex-1 px-5 py-8">
          <RetryCard
            message="অর্ডারের তথ্য লোড করা যায়নি। আপনার কি দোকান আছে?"
            onRetry={refetch}
          />
        </View>
      ) : isLoading ? (
        <View className="flex-1 px-5 py-8">
          <AIGeneratingShimmer label="অর্ডার লোড হচ্ছে" lines={4} className="w-full" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4 pb-24 gap-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={
                <Ionicons
                  name="bag-outline"
                  size={44}
                  color={colors.primary}
                />
              }
              message={
                activeTab === "all"
                  ? "আপনার দোকানে এখনো কোনো অর্ডার আসেনি।"
                  : `"${STATUS_TABS.find((t) => t.id === activeTab)?.label}" ক্যাটাগরিতে কোনো অর্ডার নেই।`
              }
              ctaLabel="রিফ্রেশ করুন"
              onCta={refetch}
            />
          ) : (
            filteredOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                updating={updatingId === order.id}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
