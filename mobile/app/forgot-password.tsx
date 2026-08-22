import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter, type Href } from "expo-router";
import { AppText, FieldInput, PrimaryButton } from "@/components/ui";
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
          <AppText variant="bodyLg" className="leading-8 text-muted">
            ইমেইলে একটি ৬ সংখ্যার কোড যাবে। কোড না এলে স্প্যাম দেখুন।
          </AppText>
        </View>

        <FieldInput
          label="ইমেইল"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="যে ইমেইল দিয়ে অ্যাকাউন্ট খুলেছিলেন"
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
          <Pressable accessibilityRole="button" className="min-h-touch items-center justify-center">
            <AppText variant="bodyLg" className="font-bengali-bold text-primary">
              লগইনে ফিরে যান
            </AppText>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}
