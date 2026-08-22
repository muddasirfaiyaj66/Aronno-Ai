import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AppText, FieldInput, PrimaryButton } from "@/components/ui";
import { getApiError, useResetPasswordMutation } from "@/services/api";
import { sanitizeOtpInput } from "@/utils/otp";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [reset, { isLoading, error }] = useResetPasswordMutation();
  const message = getApiError(error).message;

  const handleSubmit = async () => {
    try {
      await reset({
        email: email.trim(),
        code: sanitizeOtpInput(code),
        password,
      }).unwrap();
      router.replace("/login");
    } catch {
      // banner
    }
  };

  return (
    <AuthScaffold
      title="নতুন পাসওয়ার্ড"
      subtitle="কোড ও নতুন পাসওয়ার্ড দিন। পাসওয়ার্ড অন্তত ১০ অক্ষর।"
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
          placeholder="ইমেইল"
        />
        <FieldInput
          label="কোড"
          value={code}
          onChangeText={(text) => setCode(sanitizeOtpInput(text))}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          placeholder="৬ সংখ্যা"
        />
        <FieldInput
          label="নতুন পাসওয়ার্ড"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="নতুন পাসওয়ার্ড"
        />

        {message ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        <PrimaryButton
          label="পাসওয়ার্ড বদলান"
          loading={isLoading}
          disabled={!email || code.length !== 6 || password.length < 10}
          onPress={handleSubmit}
        />
      </View>
    </AuthScaffold>
  );
}
