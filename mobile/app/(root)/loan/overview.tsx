import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  EmptyState,
  LoanStatusCard,
  SecondaryButton,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetCurrentLoanQuery } from "@/services/api";

export default function LoanOverviewScreen() {
  const router = useRouter();
  const { data: loan } = useGetCurrentLoanQuery();

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">কৃষি ঋণ</AppText>
        <AppText variant="caption" className="mt-1">
          আপনার বর্তমান ঋণের অবস্থা
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        {loan ? (
          <>
            <LoanStatusCard
              title="কৃষি ঋণ"
              amount={loan.amountBn}
              status={loan.status}
              nextPaymentLabel="পরবর্তী কিস্তি"
              nextPaymentDate={loan.nextPaymentDateBn}
            />

            <SecondaryButton
              label="নতুন আবেদন"
              onPress={() => router.push("/(root)/loan/application")}
              icon={
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.ink}
                />
              }
            />
          </>
        ) : (
          <EmptyState
            icon={<Ionicons name="cash-outline" size={32} color={colors.primary} />}
            message="আপনার এখনো কোনো ঋণ নেই।"
            ctaLabel="নতুন আবেদন"
            onCta={() => router.push("/(root)/loan/application")}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
