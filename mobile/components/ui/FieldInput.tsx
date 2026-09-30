import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type FieldInputProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  /** Sits inside the field, under the text. Used by the consult mic. */
  trailing?: ReactNode;
};

export function FieldInput({
  label,
  hint,
  error,
  trailing,
  className = "",
  secureTextEntry,
  ...props
}: FieldInputProps) {
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;
  const showTrailing = !!trailing && !isPassword;
  const borderClass = error ? "border-severity-high" : "border-border";

  return (
    <View className="gap-1.5">
      <AppText variant="caption" className="font-bengali-semibold text-muted">
        {label}
      </AppText>
      <View
        className={
          showTrailing ? `overflow-hidden rounded-xl border bg-neutral ${borderClass}` : undefined
        }
      >
        <View>
          <TextInput
            placeholderTextColor={colors.muted}
            accessibilityLabel={label}
            secureTextEntry={isPassword ? hidden : false}
            underlineColorAndroid="transparent"
            className={
              showTrailing
                ? `min-h-[52px] bg-transparent px-4 font-bengali-medium text-body text-ink ${className}`
                : `min-h-[52px] rounded-xl border bg-neutral px-4 font-bengali-medium text-body text-ink ${borderClass} ${
                    isPassword ? "pr-14" : ""
                  } ${className}`
            }
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
        {showTrailing ? (
          <View className="flex-row items-center justify-end px-2 pb-2">{trailing}</View>
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
