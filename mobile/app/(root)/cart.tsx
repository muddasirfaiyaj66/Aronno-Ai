import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  DistrictPicker,
  EmptyState,
  PrimaryButton,
  RetryCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useCheckoutMutation,
  useClearCartMutation,
  useGetCartQuery,
  useGetDistrictsQuery,
  useRemoveItemMutation,
  useUpdateQuantityMutation,
} from "@/services/api";

export default function CartScreen() {
  const router = useRouter();
  const { data: districts = [] } = useGetDistrictsQuery();
  const { data: cart, isLoading, isError, refetch } = useGetCartQuery();

  const [updateQuantity] = useUpdateQuantityMutation();
  const [removeItem] = useRemoveItemMutation();
  const [clearCart, { isLoading: clearing }] = useClearCartMutation();
  const [checkout, { isLoading: checkingOut }] = useCheckoutMutation();

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [notes, setNotes] = useState("");
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cartItems = cart?.items ?? [];

  type ShopGroup = { shopName: string; items: typeof cartItems };
  const shopGroups: Record<string, ShopGroup> = {};
  for (const item of cartItems) {
    if (!shopGroups[item.shopId]) {
      shopGroups[item.shopId] = { shopName: item.shopName, items: [] };
    }
    shopGroups[item.shopId].items.push(item);
  }

  const handleOpenCheckout = (shopId: string) => {
    setSelectedShopId(shopId);
    setDistrictId(districts[0]?.slug ?? "");
    setErrorMsg(null);
    setCheckoutModalVisible(true);
  };

  const handlePlaceOrder = async () => {
    if (!selectedShopId || !shippingAddress.trim() || !contactPhone.trim() || !districtId) {
      setErrorMsg("অনুগ্ৰহ করে প্রয়োজনীয় তথ্যগুলো প্রদান করুন।");
      return;
    }
    setErrorMsg(null);
    try {
      await checkout({
        shopId: selectedShopId,
        shippingAddress: shippingAddress.trim(),
        contactPhone: contactPhone.trim(),
        districtId,
        notes: notes.trim(),
      }).unwrap();

      setCheckoutModalVisible(false);
      setOrderSuccessMsg("আপনার অর্ডারটি সফলভাবে তৈরি হয়েছে!");
      setTimeout(() => {
        setOrderSuccessMsg(null);
        router.push("/(root)/orders");
      }, 2000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "অর্ডার সম্পন্ন করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
      setErrorMsg(msg);
    }
  };

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
          শপিং কার্ট
        </AppText>
        {cartItems.length > 0 ? (
          <Pressable onPress={() => clearCart()} disabled={clearing}>
            <AppText variant="caption" className="font-bengali-semibold text-red-600">
              কার্ট খালি করুন
            </AppText>
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {orderSuccessMsg ? (
          <View className="rounded-2xl bg-severity-low-bg p-4 flex-row items-center gap-3">
            <Ionicons name="checkmark-circle" size={24} color="#027A48" />
            <AppText variant="body" className="flex-1 font-bengali-bold text-severity-low">
              {orderSuccessMsg}
            </AppText>
          </View>
        ) : null}

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
            ctaLabel="বাজার ব্রাউজ করুন"
            onCta={() => router.push("/(root)/(tabs)/market")}
          />
        ) : (
          Object.entries(shopGroups).map(([shopId, group]) => {
            const groupSubtotal = group.items.reduce((acc: number, curr: any) => acc + curr.totalPrice, 0);

            return (
              <StructuredCard
                key={shopId}
                title={group.shopName}
                icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
                footer={
                  <PrimaryButton
                    label="এই দোকানের অর্ডার সম্পন্ন করুন"
                    onPress={() => handleOpenCheckout(shopId)}
                    icon={<Ionicons name="bag-check" size={18} color={colors.white} />}
                  />
                }
              >
                <View className="gap-3">
                  {group.items.map((item: any) => (
                    <View
                      key={item.productId}
                      className="flex-row items-center justify-between border-b border-border/50 pb-3"
                    >
                      <View className="flex-1 pr-3">
                        <AppText variant="body" className="font-bengali-bold text-ink">
                          {item.productName}
                        </AppText>
                        <AppText variant="caption" className="text-muted mt-0.5">
                          ৳ {item.pricePerUnit}/{item.unit}
                        </AppText>
                        <AppText variant="caption" className="font-bengali-semibold text-primary mt-0.5">
                          মোট: ৳ {item.totalPrice}
                        </AppText>
                      </View>

                      {/* Quantity & Delete Controls */}
                      <View className="flex-row items-center gap-2">
                        <View className="flex-row items-center rounded-xl bg-neutral px-1.5 py-1">
                          <Pressable
                            onPress={() =>
                              updateQuantity({
                                productId: item.productId,
                                quantity: Math.max(item.minOrderQuantity, item.quantity - 1),
                              })
                            }
                            className="h-7 w-7 items-center justify-center rounded-lg bg-white"
                          >
                            <Ionicons name="remove" size={14} color={colors.ink} />
                          </Pressable>
                          <AppText variant="caption" className="mx-2 font-bengali-bold text-ink">
                            {item.quantity}
                          </AppText>
                          <Pressable
                            onPress={() =>
                              updateQuantity({
                                productId: item.productId,
                                quantity: Math.min(item.availableQuantity, item.quantity + 1),
                              })
                            }
                            className="h-7 w-7 items-center justify-center rounded-lg bg-white"
                          >
                            <Ionicons name="add" size={14} color={colors.ink} />
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
                  ))}

                  <View className="flex-row items-center justify-between pt-1">
                    <AppText variant="caption" className="text-muted">
                      দোকানের উপমোট
                    </AppText>
                    <AppText variant="subtitle" className="font-bengali-bold text-ink">
                      ৳ {groupSubtotal}
                    </AppText>
                  </View>
                </View>
              </StructuredCard>
            );
          })
        )}
      </ScrollView>

      {/* Checkout Modal */}
      <Modal visible={checkoutModalVisible} animationType="slide" transparent onRequestClose={() => setCheckoutModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="max-h-[85%] rounded-t-3xl bg-neutral px-5 py-6">
            <View className="flex-row items-center justify-between border-b border-border pb-3">
              <AppText variant="subtitle" className="font-bengali-bold text-ink">
                অর্ডার ও ডেলিভারির তথ্য
              </AppText>
              <Pressable onPress={() => setCheckoutModalVisible(false)} className="h-9 w-9 items-center justify-center rounded-full bg-white">
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 py-4" keyboardShouldPersistTaps="handled">
              <View className="gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  ডেলিভারির ঠিকানা <AppText className="text-red-600">*</AppText>
                </AppText>
                <TextInput
                  value={shippingAddress}
                  onChangeText={setShippingAddress}
                  placeholder="যেমনঃ গ্রাম- ধামরাই, পোস্ট- ধামরাই"
                  placeholderTextColor={colors.muted}
                  className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                />
              </View>

              <View className="gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  যোগাযোগের ফোন নম্বর <AppText className="text-red-600">*</AppText>
                </AppText>
                <TextInput
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                  placeholder="যেমনঃ 01700000000"
                  placeholderTextColor={colors.muted}
                  className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                />
              </View>

              <View className="gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  জেলা <AppText className="text-red-600">*</AppText>
                </AppText>
                <DistrictPicker districts={districts} value={districtId} onChange={setDistrictId} />
              </View>

              <View className="gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  বিশেষ নির্দেশনা (ঐচ্ছিক)
                </AppText>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="যেমনঃ সকাল ১০টার পর ডেলিভারি দিন"
                  placeholderTextColor={colors.muted}
                  className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                />
              </View>

              <View className="rounded-2xl bg-white p-4 gap-2 border border-border">
                <View className="flex-row items-center justify-between">
                  <AppText variant="caption" className="text-muted">ডেলিভারি চার্জ</AppText>
                  <AppText variant="body" className="font-bengali-semibold text-ink">৳ ৬০</AppText>
                </View>
                <View className="flex-row items-center justify-between">
                  <AppText variant="caption" className="text-muted">পেমেন্ট মেথড</AppText>
                  <AppText variant="body" className="font-bengali-bold text-primary">ক্যাশ অন ডেলিভারি</AppText>
                </View>
              </View>

              {errorMsg ? (
                <AppText variant="caption" className="font-bengali-medium text-red-600">
                  {errorMsg}
                </AppText>
              ) : null}

              <PrimaryButton
                label="অর্ডার নিশ্চিত করুন"
                onPress={handlePlaceOrder}
                loading={checkingOut}
                disabled={!shippingAddress.trim() || !contactPhone.trim() || !districtId}
                icon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
