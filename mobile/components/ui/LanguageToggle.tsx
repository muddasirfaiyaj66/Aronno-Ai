import { Pressable, View } from "react-native";
import { AppText } from "./AppText";
import { useLocale, type Locale } from "@/context/locale";

export type LanguageToggleProps = {
  className?: string;
};

export function LanguageToggle({ className = "" }: LanguageToggleProps) {
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
        className={`min-h-[36px] min-w-[48px] items-center justify-center rounded-full px-3 ${
          active ? "bg-primary" : "bg-transparent"
        }`}
      >
        <AppText
          variant="caption"
          className={`font-bengali-bold ${
            active ? "text-white" : "text-muted"
          }`}
        >
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      className={`flex-row items-center rounded-full bg-neutral-100 p-1 ${className}`}
      accessibilityRole="tablist"
    >
      <Option code="bn" label="বাং" />
      <Option code="en" label="EN" />
    </View>
  );
}
