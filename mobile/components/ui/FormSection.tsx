import { View } from "react-native";
import { AppText } from "./AppText";

export type FormSectionProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

/** White panel for stacked form fields inside settings screens. */
export function FormSection({
  title,
  children,
  className = "",
}: FormSectionProps) {
  return (
    <View className={`gap-2 ${className}`}>
      {title ? (
        <AppText
          variant="caption"
          className="px-1 font-bengali-semibold text-muted"
        >
          {title}
        </AppText>
      ) : null}
      <View className="gap-4 rounded-2xl border border-border bg-white px-4 py-4">
        {children}
      </View>
    </View>
  );
}
