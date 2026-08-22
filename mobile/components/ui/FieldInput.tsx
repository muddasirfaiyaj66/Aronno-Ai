import { useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type FieldInputProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function FieldInput({
  label,
  hint,
  className = "",
  secureTextEntry,
  ...props
}: FieldInputProps) {
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;

  return (
    <View className="gap-2">
      <AppText variant="body" className="font-bengali-bold text-ink">
        {label}
      </AppText>
      <View>
        <TextInput
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          secureTextEntry={isPassword ? hidden : false}
          className={`min-h-touch-lg rounded-2xl border border-neutral-200 bg-neutral px-4 font-bengali-medium text-body-lg text-ink ${
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
      {hint ? (
        <AppText variant="caption" className="text-muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
