import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { StructuredCard } from "./StructuredCard";
import { colors } from "@/constants/theme";

export type LoanStatus = "pending" | "approved" | "repaying" | "rejected";

const STATUS_CONFIG: Record<
  LoanStatus,
  { label: string; badgeBg: string; badgeText: string; dot: string }
> = {
  pending: {
    label: "পর্যালোচনাধীন",
    badgeBg: "bg-severity-medium-bg",
    badgeText: "text-severity-medium",
    dot: "bg-severity-medium",
  },
  approved: {
    label: "অনুমোদিত",
    badgeBg: "bg-severity-low-bg",
    badgeText: "text-severity-low",
    dot: "bg-severity-low",
  },
  repaying: {
    label: "কিস্তি চলছে",
    badgeBg: "bg-secondary",
    badgeText: "text-primary",
    dot: "bg-tertiary",
  },
  rejected: {
    label: "প্রত্যাখ্যাত",
    badgeBg: "bg-severity-high-bg",
    badgeText: "text-severity-high",
    dot: "bg-severity-high",
  },
};

export type LoanStatusCardProps = {
  title: string;
  amount: string;
  status: LoanStatus;
  nextPaymentLabel?: string;
  nextPaymentDate?: string;
  onPress?: () => void;
  className?: string;
};

export function LoanStatusCard({
  title,
  amount,
  status,
  nextPaymentLabel,
  nextPaymentDate,
  onPress,
  className = "",
}: LoanStatusCardProps) {
  const config = STATUS_CONFIG[status];

  const card = (
    <StructuredCard
      title={title}
      icon={<Ionicons name="cash-outline" size={22} color={colors.primary} />}
      className={className}
      footer={
        nextPaymentDate ? (
          <View className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3">
            <AppText variant="caption">{nextPaymentLabel}</AppText>
            <AppText variant="body" className="font-bengali-bold text-ink">
              {nextPaymentDate}
            </AppText>
          </View>
        ) : undefined
      }
    >
      <View className="flex-row items-center justify-between">
        <AppText variant="hero" style={{ fontSize: 32, lineHeight: 38 }}>
          {amount}
        </AppText>
        <View
          className={`flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 ${config.badgeBg}`}
        >
          <View className={`h-2 w-2 rounded-full ${config.dot}`} />
          <AppText
            variant="caption"
            className={`font-bengali-semibold ${config.badgeText}`}
          >
            {config.label}
          </AppText>
        </View>
      </View>
    </StructuredCard>
  );

  if (!onPress) return card;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {card}
    </Pressable>
  );
}
