import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  LoanStatusCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetCurrentLoanQuery, useGetMeQuery, useLogoutMutation } from "@/services/api";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: me } = useGetMeQuery();
  const { data: loan } = useGetCurrentLoanQuery();
  const [logout] = useLogoutMutation();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">প্রোফাইল</AppText>
        <AppText variant="caption" className="mt-1">
          আপনার খামার ও অ্যাকাউন্ট
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-5"
      >
        <StructuredCard
          title="কৃষক পরিচয়"
          icon={<Ionicons name="person" size={22} color={colors.primary} />}
        >
          <AppText variant="bodyLg">{me?.displayName ?? "—"}</AppText>
          <AppText variant="body" className="mt-1 text-muted">
            {[me?.district?.nameBn, me?.profession?.nameBn]
              .filter(Boolean)
              .join(" · ") || me?.email}
          </AppText>
        </StructuredCard>

        <View className="gap-3">
          <AppText variant="title">আর্থিক সেবা</AppText>
          {loan ? (
            <LoanStatusCard
              title="কৃষি ঋণ"
              amount={loan.amountBn}
              status={loan.status}
              nextPaymentLabel="পরবর্তী কিস্তি"
              nextPaymentDate={loan.nextPaymentDateBn}
            />
          ) : (
            <AppText variant="caption">এখনো কোনো ঋণ নেই।</AppText>
          )}
          <SecondaryButton
            label="নতুন আবেদন"
            onPress={() => router.push("/(root)/loan/overview")}
            icon={
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.ink}
              />
            }
          />
        </View>

        <SecondaryButton
          label="লগ আউট"
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
          icon={
            <Ionicons name="log-out-outline" size={20} color={colors.ink} />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
