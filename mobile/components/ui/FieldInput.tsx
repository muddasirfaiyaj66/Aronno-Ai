import { useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type FieldInputProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

export function FieldInput({
  label,
  hint,
  error,
  className = "",
  secureTextEntry,
  ...props
}: FieldInputProps) {
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;
  const borderClass = error ? "border-severity-high" : "border-border";

  return (
    <View className="gap-1.5">
      <AppText variant="caption" className="font-bengali-semibold text-muted">
        {label}
      </AppText>
      <View>
        <TextInput
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          secureTextEntry={isPassword ? hidden : false}
          className={`min-h-[52px] rounded-xl border bg-neutral px-4 font-bengali-medium text-body text-ink ${borderClass} ${
            isPassword ? "pr-14" : ""
          } ${className}`}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "পাসওয়ার্ড দেখুন" : "পাসওয়ার্ড লুকান"}
            hitSlop={8}
            className="absolute bottom-0 right-1 top-0 w-12 items-center justify-center"
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" className="text-severity-high">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" className="leading-5">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
