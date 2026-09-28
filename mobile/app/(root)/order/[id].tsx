import { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
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
import { ReviewModal } from "@/components/market/ReviewModal";
import { useGetOrderQuery, useUpdateOrderStatusMutation } from "@/services/api";
import { formatDateBn, formatPriceBn, formatUnitBn, toBn } from "@/utils/marketFormatters";

const TRACKING_STEPS = [
  { key: "pending", label: "অর্ডার করা হয়েছে", desc: "অর্ডারটি সফলভাবে জমা দেওয়া হয়েছে" },
  { key: "confirmed", label: "অর্ডার নিশ্চিত করা হয়েছে", desc: "বিক্রেতা অর্ডারটি গ্রহণ ও নিশ্চিত করেছেন" },
  { key: "processing", label: "প্রস্তুত করা হচ্ছে", desc: "পণ্য প্যাকিং ও পাঠানোর প্রস্তুতি চলছে" },
  { key: "shipped", label: "পাঠানো হয়েছে", desc: "পণ্য ডেলিভারির জন্য পাঠানো হয়েছে" },
  { key: "delivered", label: "ডেলিভারি সম্পন্ন", desc: "পণ্য গ্রাহকের কাছে পৌঁছে দেওয়া হয়েছে" },
];

const STATUS_ORDER = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedProductForReview, setSelectedProductForReview] = useState<{
    productId: string;
    productName: string;
  } | null>(null);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useGetOrderQuery(id ?? "", { skip: !id });

  const [updateStatus, { isLoading: isCancelling }] = useUpdateOrderStatusMutation();

  const handleCancelOrder = async () => {
    if (!id) return;
    try {
      await updateStatus({ id, status: "cancelled" }).unwrap();
      setConfirmCancelVisible(false);
      refetch();
    } catch (err: any) {
      Alert.alert(
        "ত্রুটি",
        err?.data?.message || "অর্ডার বাতিল করা সম্ভব হয়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।"
      );
    }
  };

  const handleCallShop = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
        <View className="border-b border-border bg-card px-5 py-3.5 flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-neutral">
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <AppText variant="subtitle" className="font-bengali-bold text-ink">
            অর্ডার বিবরণী
          </AppText>
        </View>
        <View className="p-5">
          <AIGeneratingShimmer label="অর্ডারের তথ্য লোড হচ্ছে" lines={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
        <View className="border-b border-border bg-card px-5 py-3.5 flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-neutral">
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <AppText variant="subtitle" className="font-bengali-bold text-ink">
            অর্ডার বিবরণী
          </AppText>
        </View>
        <View className="p-5">
          <RetryCard message="অর্ডারের বিবরণ লোড করতে ব্যর্থ হয়েছে।" onRetry={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  const currentStatusIndex = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  const isCancellable = order.status === "pending";

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Top Header */}
      <View className="border-b border-border bg-card px-5 py-3.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <View>
            <AppText variant="subtitle" className="font-bengali-bold text-ink">
              অর্ডার বিবরণী
            </AppText>
            <AppText variant="caption" className="font-bengali-medium text-muted">
              #{order.orderNumber}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" className="font-bengali-medium text-muted">
          {formatDateBn(order.createdAt)}
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {/* Cancelled Banner */}
        {isCancelled ? (
          <View className="rounded-2xl bg-red-50 border border-red-200 p-4 flex-row items-center gap-3">
            <Ionicons name="close-circle" size={28} color="#D92D20" />
            <View className="flex-1">
              <AppText variant="body" className="font-bengali-bold text-red-700">
                অর্ডারটি বাতিল করা হয়েছে
              </AppText>
              <AppText variant="caption" className="font-bengali-medium text-red-600 mt-0.5">
                এই অর্ডারটি এখন নিষ্ক্রিয় রয়েছে।
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Status Tracking Timeline Card */}
        <StructuredCard
          title="অর্ডার ট্র্যাকিং স্ট্যাটাস"
          icon={<Ionicons name="location" size={20} color={colors.primary} />}
        >
          <View className="py-2 px-1">
            {TRACKING_STEPS.map((step, index) => {
              const isPassed = !isCancelled && index < currentStatusIndex;
              const isCurrent = !isCancelled && index === currentStatusIndex;
              const isLast = index === TRACKING_STEPS.length - 1;

              return (
                <View key={step.key} className="flex-row items-start">
                  {/* Timeline Left Icon & Line Column */}
                  <View className="items-center mr-4 w-7">
                    {/* Circle Icon */}
                    <View
                      className={`h-7 w-7 items-center justify-center rounded-full border-2 ${
                        isPassed
                          ? "bg-emerald-600 border-emerald-600"
                          : isCurrent
                          ? "bg-forest-700 border-primary"
                          : "bg-card border-neutral-300"
                      }`}
                    >
                      {isPassed ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : isCurrent ? (
                        <View className="h-2.5 w-2.5 rounded-full bg-white" />
                      ) : (
                        <View className="h-2 w-2 rounded-full bg-neutral-300" />
                      )}
                    </View>

                    {/* Vertical Connecting Line */}
                    {!isLast ? (
                      <View
                        className={`w-0.5 my-1 min-h-[36px] ${
                          isPassed ? "bg-emerald-500" : "bg-neutral-200"
                        }`}
                      />
                    ) : null}
                  </View>

                  {/* Timeline Text Column */}
                  <View className="flex-1 pb-4">
                    <AppText
                      variant="body"
                      className={`font-bengali-bold ${
                        isCurrent
                          ? "text-primary font-bengali-bold text-base"
                          : isPassed
                          ? "text-emerald-700"
                          : "text-neutral-400"
                      }`}
                    >
                      {step.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      className={`font-bengali-medium mt-0.5 ${
                        isCurrent
                          ? "text-ink"
                          : isPassed
                          ? "text-neutral-600"
                          : "text-neutral-400"
                      }`}
                    >
                      {step.desc}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        </StructuredCard>

        {/* Shop Info Card */}
        <StructuredCard
          title="দোকানের তথ্য"
          icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <AppText variant="subtitle" className="font-bengali-bold text-ink">
                {order.shop?.name ?? "দোকান"}
              </AppText>
              {order.shop?.phone ? (
                <AppText variant="caption" className="font-bengali-medium text-muted mt-0.5">
                  ফোন: {toBn(order.shop.phone)}
                </AppText>
              ) : null}
            </View>
            {order.shop?.phone ? (
              <Pressable
                onPress={() => handleCallShop(order.shop?.phone)}
                className="h-10 px-3 flex-row items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20"
              >
                <Ionicons name="call" size={16} color={colors.primary} />
                <AppText variant="caption" className="font-bengali-bold text-primary">
                  কল করুন
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </StructuredCard>

        {/* Ordered Items Summary Card */}
        <StructuredCard
          title="অর্ডারকৃত পণ্যসামগ্রী"
          icon={<Ionicons name="bag-handle" size={20} color={colors.primary} />}
        >
          <View className="gap-3">
            {order.items.map((item: any, idx: number) => (
              <View
                key={idx}
                className="flex-row items-center justify-between border-b border-border/40 pb-3 last:border-b-0 last:pb-0"
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    className="h-12 w-12 rounded-xl bg-neutral mr-3"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-neutral-200 mr-3">
                    <Ionicons name="leaf-outline" size={20} color={colors.muted} />
                  </View>
                )}
                <View className="flex-1 pr-2">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    {item.productName}
                  </AppText>
                  <AppText variant="caption" className="font-bengali-medium text-muted mt-0.5">
                    {formatPriceBn(item.pricePerUnit)} × {toBn(item.quantity)} {formatUnitBn(item.unit)}
                  </AppText>
                </View>

                <View className="items-end">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    {formatPriceBn(item.totalPrice)}
                  </AppText>

                  {/* Rating/Review action for delivered order */}
                  {isDelivered ? (
                    <Pressable
                      onPress={() => {
                        setSelectedProductForReview({
                          productId: item.productId,
                          productName: item.productName,
                        });
                        setReviewModalVisible(true);
                      }}
                      className="mt-1 flex-row items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1"
                    >
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <AppText variant="caption" className="font-bengali-bold text-amber-700 text-xs">
                        রিভিউ দিন
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </StructuredCard>

        {/* Pricing Breakdown Card */}
        <StructuredCard
          title="মূল্য বিবরণী"
          icon={<Ionicons name="receipt" size={20} color={colors.primary} />}
        >
          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <AppText variant="body" className="font-bengali-medium text-muted">
                পণ্যের সাবটোটাল
              </AppText>
              <AppText variant="body" className="font-bengali-semibold text-ink">
                {formatPriceBn(order.subtotalBdt)}
              </AppText>
            </View>
            <View className="flex-row items-center justify-between">
              <AppText variant="body" className="font-bengali-medium text-muted">
                ডেলিভারি চার্জ
              </AppText>
              <AppText variant="body" className="font-bengali-semibold text-ink">
                {formatPriceBn(order.deliveryFeeBdt)}
              </AppText>
            </View>
            <View className="h-px bg-border my-1" />
            <View className="flex-row items-center justify-between">
              <AppText variant="subtitle" className="font-bengali-bold text-ink">
                সর্বমোট
              </AppText>
              <AppText variant="subtitle" className="font-bengali-bold text-primary">
                {formatPriceBn(order.totalBdt)}
              </AppText>
            </View>
            <View className="flex-row items-center justify-between pt-1">
              <AppText variant="caption" className="font-bengali-medium text-muted">
                পেমেন্ট পদ্ধতি
              </AppText>
              <AppText variant="caption" className="font-bengali-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {order.paymentStatus === "cash_on_delivery" || !order.paymentStatus
                  ? "ক্যাশ অন ডেলিভারি"
                  : order.paymentStatus}
              </AppText>
            </View>
          </View>
        </StructuredCard>

        {/* Delivery Address Card */}
        <StructuredCard
          title="ডেলিভারি ঠিকানা"
          icon={<Ionicons name="map" size={20} color={colors.primary} />}
        >
          <View className="gap-1">
            {order.contactPhone ? (
              <AppText variant="body" className="font-bengali-semibold text-ink">
                যোগাযোগ: {toBn(order.contactPhone)}
              </AppText>
            ) : null}
            <AppText variant="body" className="font-bengali-medium text-ink mt-0.5">
              {order.shippingAddress}
            </AppText>
            {order.district?.nameBn ? (
              <AppText variant="caption" className="font-bengali-medium text-muted mt-0.5">
                জেলা: {order.district.nameBn}
              </AppText>
            ) : null}
          </View>
        </StructuredCard>

        {/* Cancellable Action Button */}
        {isCancellable ? (
          <View className="pt-2">
            <SecondaryButton
              label="অর্ডার বাতিল করুন"
              onPress={() => setConfirmCancelVisible(true)}
              loading={isCancelling}
              icon={<Ionicons name="close-circle-outline" size={18} color="#D92D20" />}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Confirmation Modal for Cancellation */}
      <Modal
        visible={confirmCancelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmCancelVisible(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-5">
          <View className="w-full rounded-3xl bg-card p-6 gap-4">
            <View className="h-12 w-12 rounded-full bg-red-100 items-center justify-center self-center">
              <Ionicons name="warning" size={24} color="#D92D20" />
            </View>

            <AppText variant="subtitle" className="font-bengali-bold text-center text-ink">
              অর্ডার নিশ্চিতকরণ
            </AppText>

            <AppText variant="body" className="font-bengali-medium text-center text-muted">
              আপনি কি নিশ্চিত যে আপনি এই অর্ডারটি বাতিল করতে চান?
            </AppText>

            <View className="gap-2.5 pt-2">
              <PrimaryButton
                label="হ্যাঁ, বাতিল করুন"
                onPress={handleCancelOrder}
                loading={isCancelling}
                className="bg-red-600"
              />
              <SecondaryButton
                label="না, রাখুন"
                onPress={() => setConfirmCancelVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      {selectedProductForReview ? (
        <ReviewModal
          visible={reviewModalVisible}
          onClose={() => {
            setReviewModalVisible(false);
            setSelectedProductForReview(null);
          }}
          orderId={order.id}
          productId={selectedProductForReview.productId}
          productName={selectedProductForReview.productName}
        />
      ) : null}
    </SafeAreaView>
  );
}
