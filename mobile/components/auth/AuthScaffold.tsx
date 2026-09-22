import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

export type AuthScaffoldProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthScaffold({
  title,
  subtitle,
  children,
  footer,
}: AuthScaffoldProps) {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-5 pb-10 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center">
            <View
              style={{
                shadowColor: colors.primary,
                shadowOpacity: 0.28,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
                borderRadius: 22,
              }}
            >
              <Image
                source={require("@/assets/images/icon.png")}
                accessibilityLabel="আরণ্য"
                style={{ height: 72, width: 72, borderRadius: 22 }}
              />
            </View>
            <AppText
              variant="caption"
              className="mt-4 font-bengali-bold text-primary"
            >
              আরণ্য
            </AppText>
            <AppText variant="title" className="mt-2 text-center">
              {title}
            </AppText>
            <AppText
              variant="body"
              className="mt-2 max-w-[320px] text-center leading-7 text-muted"
            >
              {subtitle}
            </AppText>
          </View>

          <View
            className="rounded-[28px] border border-border bg-white px-5 py-6"
            style={{
              shadowColor: colors.ink,
              shadowOpacity: 0.06,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 3,
            }}
          >
            {children}
          </View>

          {footer ? <View className="mt-6 items-center">{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
