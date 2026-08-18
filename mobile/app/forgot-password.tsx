import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter, type Href } from "expo-router";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { getApiError, useForgotPasswordMutation } from "@/services/api";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [forgot, { isLoading, error }] = useForgotPasswordMutation();
  const message = getApiError(error).message;

  const handleSubmit = async () => {
    try {
      await forgot({ email: email.trim() }).unwrap();
      router.push({
        pathname: "/reset-password",
        params: { email: email.trim() },
      } as unknown as Href);
    } catch {
      // banner
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <AppText variant="title">পাসওয়ার্ড ভুলে গেছেন?</AppText>
          <AppText variant="body" className="text-muted">
            ইমেইলে একটি রিসেট কোড পাঠানো হবে
          </AppText>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ইমেইল"
          placeholderTextColor={colors.muted}
          accessibilityLabel="ইমেইল"
          className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
        />

        {message ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        <PrimaryButton
          label="কোড পাঠান"
          loading={isLoading}
          disabled={!email}
          onPress={handleSubmit}
        />

        <Link href="/login" asChild>
          <Pressable accessibilityRole="button">
            <AppText variant="body" className="text-center text-primary">
              লগইনে ফিরে যান
            </AppText>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}
