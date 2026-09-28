import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, PrimaryButton } from "@/components/ui";
import { useGetOrderQuery } from "@/services/api";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function PaymentReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; result?: string }>();
  const orderId = one(params.orderId);
  const result = one(params.result);
  const { data: order } = useGetOrderQuery(orderId, { skip: !orderId });
  const paid = result === "paid" || order?.paymentStatus === "paid";
  const failed = result === "failed" || order?.paymentStatus === "failed";
  const orderNumber = typeof order?.orderNumber === "string" ? order.orderNumber : "";

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <View
          className={`h-28 w-28 items-center justify-center rounded-full ${paid ? "bg-green-100" : "bg-red-50"}`}
        >
          <Ionicons
            name={paid ? "checkmark-circle" : "close-circle"}
            size={72}
            color={paid ? "#027A48" : "#B42318"}
          />
        </View>
        <View className="items-center gap-3">
          <AppText
            variant="subtitle"
            className="text-center font-bengali-bold text-ink"
            style={{ fontSize: 20, lineHeight: 30 }}
          >
            {paid
              ? "আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে!"
              : failed
                ? "পেমেন্ট হয়নি। অর্ডার বাতিল হয়েছে।"
                : "পেমেন্ট এখনো নিশ্চিত হয়নি।"}
          </AppText>
          {paid && orderNumber ? (
            <View className="rounded-full bg-primary/10 px-6 py-2">
              <AppText variant="body" className="font-bengali-bold text-primary">
                অর্ডার নম্বর: #{orderNumber}
              </AppText>
            </View>
          ) : null}
          <AppText
            variant="body"
            className="text-center font-bengali-medium text-muted"
            style={{ lineHeight: 24 }}
          >
            {paid
              ? "দোকানদার শীঘ্রই আপনার অর্ডার নিশ্চিত করবেন।"
              : "অর্ডার তালিকায় অবস্থা দেখুন।"}
          </AppText>
        </View>
        <View className="w-full">
          <PrimaryButton
            label="অর্ডার দেখুন"
            onPress={() => router.replace("/(root)/orders")}
            icon={<Ionicons name="bag-handle" size={18} color="#fff" />}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
