import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, StructuredCard } from "@/components/ui";
import { colors } from "@/constants/theme";
import type { CostEstimateResult, CultivationCost } from "@/types/treatment";
import { formatTakaBn } from "@/utils/number";

export type CultivationCostCardProps = {
  cost: CultivationCost;
  /** Caption above the total, e.g. "আলু · ২ বিঘা". */
  caption: string;
  /** Spray figures from the cost endpoint, when available. */
  spray?: Pick<CostEstimateResult, "pesticideQuantity" | "spraySessions">;
};

export function CultivationCostCard({ cost, caption, spray }: CultivationCostCardProps) {
  return (
    <StructuredCard
      title="আনুমানিক চাষের খরচ"
      icon={<Ionicons name="cash-outline" size={22} color={colors.primary} />}
      footer={
        <AppText variant="caption" className="text-muted">
          বাজারদর ও এলাকাভেদে খরচ কম-বেশি হতে পারে।
        </AppText>
      }
    >
      <View className="gap-4">
        <View>
          <AppText variant="caption">{caption}</AppText>
          <AppText variant="hero">৳ {formatTakaBn(cost.totalBdt)}</AppText>
        </View>

        <View className="gap-2">
          {cost.items.map((item) => (
            <View
              key={item.labelBn}
              className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3"
            >
              <View className="flex-1 pr-3">
                <AppText variant="body" className="font-bengali-semibold text-ink">
                  {item.labelBn}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  {item.quantityBn}
                </AppText>
              </View>
              <AppText variant="body" className="font-bengali-bold text-ink">
                ৳ {formatTakaBn(item.costBdt)}
              </AppText>
            </View>
          ))}
        </View>

        {spray ? (
          <View className="flex-row justify-between rounded-2xl bg-secondary px-4 py-3">
            <View>
              <AppText variant="caption">কীটনাশকের পরিমাণ</AppText>
              <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                {spray.pesticideQuantity}
              </AppText>
            </View>
            <View>
              <AppText variant="caption">স্প্রে সংখ্যা</AppText>
              <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                {spray.spraySessions} বার
              </AppText>
            </View>
          </View>
        ) : null}
      </View>
    </StructuredCard>
  );
}
