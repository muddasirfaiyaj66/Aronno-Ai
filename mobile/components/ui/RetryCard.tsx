import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { PrimaryButton } from "./PrimaryButton";

export type RetryCardProps = {
  /** Short Bangla message — never a raw technical error string. */
  message?: string;
  onRetry: () => void;
  className?: string;
};

export function RetryCard({
  message = "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
  onRetry,
  className = "",
}: RetryCardProps) {
  return (
    <View
      className={`items-center rounded-card border border-severity-high-bg bg-card px-5 py-6 ${className}`}
    >
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-severity-high-bg">
        <Ionicons name="refresh-circle" size={36} color="#B42318" />
      </View>
      <AppText variant="bodyLg" className="mb-1 text-center text-primary">
        আবার চেষ্টা করুন
      </AppText>
      <AppText variant="body" className="mb-5 text-center text-muted">
        {message}
      </AppText>
      <PrimaryButton label="পুনরায় চেষ্টা" onPress={onRetry} className="w-full" />
    </View>
  );
}
