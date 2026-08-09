import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { AppText } from "./AppText";

export type StructuredCardProps = ViewProps & {
  title: string;
  icon?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Soft mint surface without heavy chrome */
  tone?: "plain" | "soft";
  className?: string;
};

export function StructuredCard({
  title,
  icon,
  footer,
  children,
  tone = "plain",
  className = "",
  ...props
}: StructuredCardProps) {
  const surface = tone === "soft" ? "bg-secondary" : "bg-white";

  return (
    <View
      className={`overflow-hidden rounded-3xl ${surface} ${className}`}
      {...props}
    >
      <View className="flex-row items-center gap-3 px-5 pt-5">
        {icon ? (
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
            {icon}
          </View>
        ) : null}
        <AppText variant="bodyLg" className="flex-1 font-bengali-bold text-primary">
          {title}
        </AppText>
      </View>

      {children ? <View className="px-5 py-4">{children}</View> : null}

      {footer ? <View className="px-5 pb-5">{footer}</View> : null}
    </View>
  );
}
