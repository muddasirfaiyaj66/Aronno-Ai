import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  PrimaryButton,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useCheckoutMutation,
  useGetCartQuery,
  useGetDistrictsQuery,
  useGetMeQuery,
} from "@/services/api";
import { getApiError } from "@/services/api";
import { formatPriceBn, formatUnitBn, toBn } from "@/utils/marketFormatters";

// ─── Step indicator ──────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "ঠিকানা",
  2: "অর্ডার সারাংশ",
  3: "পেমেন্ট",
};

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = [1, 2, 3];
  return (
    <View className="flex-row items-center justify-center gap-1 py-3">
      {steps.map((s, i) => {
        const done = s < current;
        const active = s === current;
        return (
          <View key={s} className="flex-row items-center">
            <View
              className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
                active
                  ? "border-primary bg-primary"
                  : done
                    ? "border-primary bg-primary/20"
                    : "border-border bg-neutral"
              }`}
            >
              {done ? (
                <Ionicons name="checkmark" size={14} color={colors.primary} />
              ) : (
                <AppText
                  variant="caption"
                  className={`font-bengali-bold ${active ? "text-white" : "text-muted"}`}
                >
                  {toBn(s)}
                </AppText>
              )}
            </View>
            {i < steps.length - 1 && (
              <View
                className={`h-0.5 w-10 mx-1 ${done ? "bg-primary" : "bg-border"}`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Address form ─────────────────────────────────────────────────────────────
interface AddressForm {
  buyerName: string;
  phone: string;
  districtId: string;
  districtName: string;
  upazila: string;
  fullAddress: string;
}

function AddressStep({
  form,
  onChange,
  onNext,
}: {
  form: AddressForm;
  onChange: (f: Partial<AddressForm>) => void;
  onNext: () => void;
}) {
  const { data: districts = [] } = useGetDistrictsQuery();
  const [districtOpen, setDistrictOpen] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  const validate = () => {
    const e: Partial<Record<keyof AddressForm, string>> = {};
    if (!form.buyerName.trim()) e.buyerName = "নাম আবশ্যক";
    if (!form.phone.trim() || form.phone.length < 10) e.phone = "সঠিক ফোন নম্বর দিন";
    if (!form.districtId) e.districtId = "জেলা নির্বাচন করুন";
    if (!form.fullAddress.trim()) e.fullAddress = "সম্পূর্ণ ঠিকানা আবশ্যক";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <View className="gap-5">
      <StructuredCard
        title="ডেলিভারি ঠিকানা"
        icon={<Ionicons name="location" size={20} color={colors.primary} />}
      >
        <View className="gap-4">
          {/* Name */}
          <View className="gap-1.5">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              প্রাপকের নাম
            </AppText>
            <TextInput
              value={form.buyerName}
              onChangeText={(v) => onChange({ buyerName: v })}
              placeholder="আপনার পুরো নাম লিখুন"
              placeholderTextColor={colors.muted}
              className="rounded-xl border border-border bg-white px-4 py-3 text-ink"
              style={{ fontFamily: "NotoSerifBengali_400Regular", fontSize: 15 }}
            />
            {errors.buyerName ? (
              <AppText variant="caption" className="text-red-500 font-bengali-medium">
                {errors.buyerName}
              </AppText>
            ) : null}
          </View>

          {/* Phone */}
          <View className="gap-1.5">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              ফোন নম্বর
            </AppText>
            <TextInput
              value={form.phone}
              onChangeText={(v) => onChange({ phone: v })}
              placeholder="01XXXXXXXXX"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              className="rounded-xl border border-border bg-white px-4 py-3 text-ink"
              style={{ fontFamily: "NotoSerifBengali_400Regular", fontSize: 15 }}
            />
            {errors.phone ? (
              <AppText variant="caption" className="text-red-500 font-bengali-medium">
                {errors.phone}
              </AppText>
            ) : null}
          </View>

          {/* District picker */}
          <View className="gap-1.5">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              জেলা
            </AppText>
            <Pressable
              onPress={() => setDistrictOpen((o) => !o)}
              className="flex-row items-center justify-between rounded-xl border border-border bg-white px-4 py-3"
            >
              <AppText
                variant="body"
                className={form.districtId ? "text-ink font-bengali-medium" : "text-muted"}
              >
                {form.districtName || "জেলা নির্বাচন করুন"}
              </AppText>
              <Ionicons
                name={districtOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.muted}
              />
            </Pressable>

            {districtOpen && (
              <View className="max-h-48 rounded-xl border border-border bg-white overflow-hidden">
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {districts.map((d) => (
                    <Pressable
                      key={d.id ?? d.slug}
                      onPress={() => {
                        onChange({ districtId: d.id ?? d.slug, districtName: d.nameBn });
                        setDistrictOpen(false);
                      }}
                      className={`px-4 py-3 border-b border-border/30 ${
                        form.districtId === (d.id ?? d.slug) ? "bg-primary/10" : ""
                      }`}
                    >
                      <AppText
                        variant="body"
                        className={`font-bengali-medium ${
                          form.districtId === (d.id ?? d.slug) ? "text-primary" : "text-ink"
                        }`}
                      >
                        {d.nameBn}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {errors.districtId ? (
              <AppText variant="caption" className="text-red-500 font-bengali-medium">
                {errors.districtId}
              </AppText>
            ) : null}
          </View>

          {/* Upazila */}
          <View className="gap-1.5">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              উপজেলা <AppText variant="caption" className="text-muted">(ঐচ্ছিক)</AppText>
            </AppText>
            <TextInput
              value={form.upazila}
              onChangeText={(v) => onChange({ upazila: v })}
              placeholder="উপজেলার নাম লিখুন"
              placeholderTextColor={colors.muted}
              className="rounded-xl border border-border bg-white px-4 py-3 text-ink"
              style={{ fontFamily: "NotoSerifBengali_400Regular", fontSize: 15 }}
            />
          </View>

          {/* Full address */}
          <View className="gap-1.5">
            <AppText variant="caption" className="font-bengali-semibold text-ink">
              সম্পূর্ণ ঠিকানা
            </AppText>
            <TextInput
              value={form.fullAddress}
              onChangeText={(v) => onChange({ fullAddress: v })}
              placeholder="গ্রাম/এলাকা, ডাকঘর, বিস্তারিত ঠিকানা লিখুন"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="rounded-xl border border-border bg-white px-4 py-3 text-ink"
              style={{
                fontFamily: "NotoSerifBengali_400Regular",
                fontSize: 15,
                minHeight: 80,
              }}
            />
            {errors.fullAddress ? (
              <AppText variant="caption" className="text-red-500 font-bengali-medium">
                {errors.fullAddress}
              </AppText>
            ) : null}
          </View>
        </View>
      </StructuredCard>

      <PrimaryButton
        label="পরবর্তী ধাপে যান"
        onPress={() => {
          if (validate()) onNext();
        }}
        icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
      />
    </View>
  );
}

// ─── Order summary ────────────────────────────────────────────────────────────
const DELIVERY_FEE = 60;

function SummaryStep({
  cart,
  onNext,
  onBack,
}: {
  cart: any;
  onNext: () => void;
  onBack: () => void;
}) {
  const items: any[] = cart?.items ?? [];
  const subtotal: number = cart?.totalBdt ?? 0;
  const total = subtotal + DELIVERY_FEE;

  return (
    <View className="gap-5">
      {/* Shop info */}
      <StructuredCard
        title={cart?.shopName ?? "দোকান"}
        icon={<Ionicons name="storefront" size={20} color={colors.primary} />}
      >
        <View className="gap-3">
          {items.map((item: any, i: number) => (
            <View
              key={item.productId ?? i}
              className="flex-row items-start justify-between border-b border-border/40 pb-2.5"
            >
              <View className="flex-1 pr-3">
                <AppText
                  variant="body"
                  className="font-bengali-semibold text-ink"
                  numberOfLines={2}
                >
                  {item.productName}
                </AppText>
                <AppText variant="caption" className="text-muted font-bengali-medium mt-0.5">
                  {toBn(item.quantity)} {formatUnitBn(item.unit)} × {formatPriceBn(item.pricePerUnit)}
                </AppText>
              </View>
              <AppText variant="body" className="font-bengali-bold text-ink">
                {formatPriceBn(item.totalPrice)}
              </AppText>
            </View>
          ))}
        </View>
      </StructuredCard>

      {/* Price breakdown */}
      <StructuredCard
        title="মূল্য বিবরণ"
        icon={<Ionicons name="calculator" size={20} color={colors.primary} />}
      >
        <View className="gap-3">
          <View className="flex-row justify-between">
            <AppText variant="body" className="text-muted font-bengali-medium">
              পণ্যের মূল্য ({toBn(items.length)}টি)
            </AppText>
            <AppText variant="body" className="font-bengali-semibold text-ink">
              {formatPriceBn(subtotal)}
            </AppText>
          </View>

          <View className="flex-row justify-between">
            <AppText variant="body" className="text-muted font-bengali-medium">
              ডেলিভারি চার্জ
            </AppText>
            <AppText variant="body" className="font-bengali-semibold text-ink">
              {formatPriceBn(DELIVERY_FEE)}
            </AppText>
          </View>

          <View className="border-t border-border/60 pt-3 flex-row justify-between">
            <AppText variant="subtitle" className="font-bengali-bold text-ink">
              সর্বমোট পরিশোধযোগ্য
            </AppText>
            <AppText variant="subtitle" className="font-bengali-bold text-primary">
              {formatPriceBn(total)}
            </AppText>
          </View>
        </View>
      </StructuredCard>

      <View className="flex-row gap-3">
        <SecondaryButton
          label="পেছনে যান"
          onPress={onBack}
          icon={<Ionicons name="arrow-back" size={16} color={colors.ink} />}
        />
        <View className="flex-1">
          <PrimaryButton
            label="পরবর্তী ধাপ"
            onPress={onNext}
            icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Payment step ─────────────────────────────────────────────────────────────
function PaymentStep({
  cart,
  form,
  onConfirm,
  onBack,
  isLoading,
  error,
}: {
  cart: any;
  form: AddressForm;
  onConfirm: () => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const subtotal: number = cart?.totalBdt ?? 0;
  const total = subtotal + DELIVERY_FEE;

  return (
    <View className="gap-5">
      {/* Delivery address recap */}
      <StructuredCard
        title="ডেলিভারি ঠিকানা"
        icon={<Ionicons name="location" size={20} color={colors.primary} />}
      >
        <View className="gap-1.5">
          <AppText variant="body" className="font-bengali-bold text-ink">
            {form.buyerName}
          </AppText>
          <AppText variant="body" className="text-muted font-bengali-medium">
            📞 {form.phone}
          </AppText>
          <AppText variant="body" className="text-muted font-bengali-medium">
            📍 {form.fullAddress}
            {form.upazila ? `, ${form.upazila}` : ""}
            {form.districtName ? `, ${form.districtName}` : ""}
          </AppText>
        </View>
      </StructuredCard>

      {/* Payment method selection */}
      <StructuredCard
        title="পেমেন্ট পদ্ধতি"
        icon={<Ionicons name="wallet" size={20} color={colors.primary} />}
      >
        <View className="gap-3">
          {/* Cash on delivery — only option for v1 */}
          <View className="flex-row items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Ionicons name="cash" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <AppText variant="body" className="font-bengali-bold text-ink">
                ক্যাশ অন ডেলিভারি
              </AppText>
              <AppText variant="caption" className="text-muted font-bengali-medium">
                পণ্য পাওয়ার সময় নগদ পরিশোধ করুন
              </AppText>
            </View>
            <View className="h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-primary">
              <View className="h-2 w-2 rounded-full bg-white" />
            </View>
          </View>

          {/* Total to pay */}
          <View className="flex-row items-center justify-between rounded-xl bg-neutral px-4 py-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              পরিশোধযোগ্য মোট
            </AppText>
            <AppText
              variant="subtitle"
              className="font-bengali-bold text-primary"
              style={{ fontSize: 20 }}
            >
              {formatPriceBn(total)}
            </AppText>
          </View>
        </View>
      </StructuredCard>

      {/* Error message */}
      {error ? (
        <View className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AppText variant="body" className="text-red-600 font-bengali-medium">
            ❌ {error}
          </AppText>
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <SecondaryButton
          label="পেছনে"
          onPress={onBack}
          icon={<Ionicons name="arrow-back" size={16} color={colors.ink} />}
        />
        <View className="flex-1">
          <PrimaryButton
            label={isLoading ? "অর্ডার হচ্ছে..." : "অর্ডার নিশ্চিত করুন"}
            onPress={onConfirm}
            loading={isLoading}
            icon={
              isLoading ? undefined : (
                <Ionicons name="checkmark-circle" size={18} color={colors.white} />
              )
            }
          />
        </View>
      </View>
    </View>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({
  orderNumber,
  onViewOrders,
}: {
  orderNumber: string;
  onViewOrders: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-8 px-6">
      {/* Animated tick */}
      <View className="h-28 w-28 items-center justify-center rounded-full bg-green-100">
        <Ionicons name="checkmark-circle" size={72} color="#027A48" />
      </View>

      <View className="items-center gap-3">
        <AppText
          variant="subtitle"
          className="font-bengali-bold text-ink text-center"
          style={{ fontSize: 20, lineHeight: 30 }}
        >
          আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে!
        </AppText>
        <View className="rounded-full bg-primary/10 px-6 py-2">
          <AppText variant="body" className="font-bengali-bold text-primary">
            অর্ডার নম্বর: #{orderNumber}
          </AppText>
        </View>
        <AppText
          variant="body"
          className="text-muted font-bengali-medium text-center"
          style={{ lineHeight: 24 }}
        >
          দোকানদার শীঘ্রই আপনার অর্ডার নিশ্চিত করবেন। ডেলিভারির সময় নগদ অর্থ প্রদান করুন।
        </AppText>
      </View>

      <View className="w-full gap-3">
        <PrimaryButton
          label="অর্ডার দেখুন"
          onPress={onViewOrders}
          icon={<Ionicons name="bag-handle" size={18} color={colors.white} />}
        />
      </View>
    </View>
  );
}

// ─── Main checkout screen ─────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const router = useRouter();
  const { data: cart } = useGetCartQuery();
  const { data: me } = useGetMeQuery();
  const [checkout, { isLoading }] = useCheckoutMutation();

  const [step, setStep] = useState<Step>(1);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{ orderNumber: string } | null>(null);

  const [form, setForm] = useState<AddressForm>({
    buyerName: me?.displayName ?? "",
    phone: me?.phone ?? "",
    districtId: "",
    districtName: "",
    upazila: "",
    fullAddress: "",
  });

  const updateForm = (partial: Partial<AddressForm>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const handleConfirm = async () => {
    if (!cart?.shopId) {
      setCheckoutError("কার্টে দোকানের তথ্য পাওয়া যায়নি। অনুগ্রহ করে কার্টে ফিরে যান।");
      return;
    }
    setCheckoutError(null);
    try {
      const result = await checkout({
        shopId: cart.shopId,
        shippingAddress: form.fullAddress,
        contactPhone: form.phone,
        districtId: form.districtId,
        buyerName: form.buyerName,
        upazila: form.upazila || undefined,
        paymentMethod: "cash_on_delivery",
      }).unwrap();

      setCompletedOrder({ orderNumber: result.orderNumber });
    } catch (err: any) {
      const { message } = getApiError(err);
      setCheckoutError(
        message ?? "অর্ডার প্রক্রিয়াকরণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
      );
    }
  };

  // ── Success state ──
  if (completedOrder) {
    return (
      <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
        <SuccessScreen
          orderNumber={completedOrder.orderNumber}
          onViewOrders={() => router.replace("/(root)/orders")}
        />
      </SafeAreaView>
    );
  }

  const stepTitle = STEP_LABELS[step];

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-border bg-white px-5 py-3.5 gap-3">
        <Pressable
          onPress={() => {
            if (step === 1) router.back();
            else setStep((s) => (s - 1) as Step);
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="subtitle" className="font-bengali-bold text-ink">
            চেকআউট
          </AppText>
          <AppText variant="caption" className="text-muted font-bengali-medium">
            ধাপ {toBn(step)} / {toBn(3)} — {stepTitle}
          </AppText>
        </View>
      </View>

      {/* Step indicator */}
      <View className="bg-white border-b border-border px-5">
        <StepIndicator current={step} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-32"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <AddressStep
            form={form}
            onChange={updateForm}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <SummaryStep
            cart={cart}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <PaymentStep
            cart={cart}
            form={form}
            onConfirm={handleConfirm}
            onBack={() => setStep(2)}
            isLoading={isLoading}
            error={checkoutError}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
