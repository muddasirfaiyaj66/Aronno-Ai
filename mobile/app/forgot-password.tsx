import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
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
    <AuthScaffold
      title="পাসওয়ার্ড ভুলে গেছেন?"
      subtitle="ইমেইলে একটি ৬ সংখ্যার কোড যাবে। কোড না এলে স্প্যাম ফোল্ডার দেখুন।"
      footer={
        <Link href="/login" asChild>
          <Pressable accessibilityRole="button" className="min-h-touch items-center justify-center">
            <AppText variant="body" className="font-bengali-bold text-primary">
              লগইনে ফিরে যান
            </AppText>
          </Pressable>
        </Link>
      }
    >
      <View className="gap-5">
        <FieldInput
          label="ইমেইল"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
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
      </View>
    </AuthScaffold>
  );
}
