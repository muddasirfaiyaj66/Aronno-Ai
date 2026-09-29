import { View } from "react-native";
import { AppText } from "@/components/ui";
import { CONSULT_STATUS_BN, type ConsultStatus } from "@/types/consult";

const TONE: Record<ConsultStatus, { wrap: string; text: string }> = {
  requested: { wrap: "bg-harvest-soft", text: "text-harvest" },
  accepted: { wrap: "bg-secondary", text: "text-primary" },
  ringing: { wrap: "bg-harvest-soft", text: "text-harvest" },
  in_call: { wrap: "bg-secondary", text: "text-primary" },
  ended: { wrap: "bg-neutral-100", text: "text-muted" },
  completed: { wrap: "bg-secondary", text: "text-primary" },
  cancelled: { wrap: "bg-danger-soft", text: "text-danger" },
};

export function ConsultStatusChip({ status }: { status: ConsultStatus }) {
  const tone = TONE[status];
  return (
    <View className={`self-start rounded-full px-3 py-1 ${tone.wrap}`}>
      <AppText variant="caption" className={`font-bengali-semibold ${tone.text}`}>
        {CONSULT_STATUS_BN[status]}
      </AppText>
    </View>
  );
}
