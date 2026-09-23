import { Text, type TextProps } from "react-native";

type Variant = "caption" | "body" | "bodyLg" | "subtitle" | "title" | "display" | "hero";

const variantClass: Record<Variant, string> = {
  caption: "font-bengali text-caption text-muted",
  body: "font-bengali text-body text-ink",
  bodyLg: "font-bengali-medium text-body-lg text-ink",
  subtitle: "font-bengali-bold text-body-lg text-ink",
  title: "font-bengali-bold text-title text-ink",
  display: "font-bengali-bold text-display text-primary",
  hero: "font-bengali-bold text-hero text-primary",
};

type AppTextProps = TextProps & {
  variant?: Variant;
  className?: string;
};

export function AppText({
  variant = "body",
  className = "",
  ...props
}: AppTextProps) {
  return (
    <Text className={`${variantClass[variant]} ${className}`} {...props} />
  );
}
