import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AppText, FieldInput, PrimaryButton } from "@/components/ui";
import { useResetPasswordMutation } from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { validateResetPasswordBn } from "@/lib/authValidation";
import { sanitizeOtpInput } from "@/utils/otp";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [reset, { isLoading, error, reset: resetMutation }] =
    useResetPasswordMutation();
  const message =
    localError ??
    (error
      ? userFacingError(
          error,
          "auth",
          "পাসওয়ার্ড বদলানো যায়নি। কোড ও পাসওয়ার্ড দেখুন।",
        )
      : undefined);

  const handleSubmit = async () => {
    const clientMsg = validateResetPasswordBn({
      email,
      code: sanitizeOtpInput(code),
      password,
    });
    if (clientMsg) {
      setLocalError(clientMsg);
      resetMutation();
      return;
    }
    setLocalError(null);
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
      subtitle="কোড ও নতুন পাসওয়ার্ড দিন। পাসওয়ার্ডে ১০+ অক্ষর, বড়/ছোট হাতের অক্ষর, সংখ্যা ও বিশেষ চিহ্ন লাগবে।"
      footer={
        <Link href="/login" asChild>
          <Pressable
            accessibilityRole="button"
            className="min-h-touch items-center justify-center"
          >
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
          onChangeText={(t) => {
            setEmail(t);
            setLocalError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="ইমেইল"
        />
        <FieldInput
          label="কোড"
          value={code}
          onChangeText={(text) => {
            setCode(sanitizeOtpInput(text));
            setLocalError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          placeholder="৬ সংখ্যা"
        />
        <FieldInput
          label="নতুন পাসওয়ার্ড"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setLocalError(null);
          }}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint="কমপক্ষে ১০ অক্ষর, বড় হাত, ছোট হাত, সংখ্যা ও চিহ্ন"
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
          disabled={!email.trim() || !code || !password}
          onPress={handleSubmit}
        />
      </View>
    </AuthScaffold>
  );
}
