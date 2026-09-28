import { Pressable, View } from "react-native";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";
import { useLocale, type Locale } from "@/context/locale";

export type LanguageToggleProps = {
  className?: string;
  /** High contrast on a dark (forest) background */
  light?: boolean;
};

export function LanguageToggle({
  className = "",
  light = false,
}: LanguageToggleProps) {
  const { locale, setLocale } = useLocale();

  const Option = ({
    code,
    label,
  }: {
    code: Locale;
    label: string;
  }) => {
    const active = locale === code;
    return (
      <Pressable
        onPress={() => setLocale(code)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        className={`min-h-[40px] min-w-[48px] items-center justify-center rounded-full px-3 ${
          active ? (light ? "bg-white" : "bg-forest-700") : "bg-transparent"
        }`}
      >
        <AppText
          variant="caption"
          className="font-bengali-bold"
          style={{
            color: active
              ? light
                ? "#0F766E"
                : "#FFFFFF"
              : light
                ? "rgba(255,255,255,0.88)"
                : colors.muted,
          }}
        >
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      className={`flex-row items-center rounded-full p-1 ${
        light ? "bg-white/20" : "bg-neutral-100"
      } ${className}`}
    >
      <Option code="bn" label="বাং" />
      <Option code="en" label="EN" />
    </View>
  );
}
