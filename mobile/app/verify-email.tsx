import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AppText, FieldInput, PrimaryButton, SecondaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  getApiError,
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from "@/services/api";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [verify, { isLoading, error }] = useVerifyEmailMutation();
  const [resend, { isLoading: resending, isSuccess: resent }] =
    useResendVerificationMutation();

  const message = getApiError(error).message;

  const handleSubmit = async () => {
    try {
      await verify({ email: email.trim(), code: code.trim() }).unwrap();
      router.replace("/(root)/(tabs)");
    } catch {
      // banner
    }
  };

  return (
    <AuthScaffold
      title="ইমেইল যাচাই করুন"
      subtitle="ইনবক্সে পাঠানো ৬ সংখ্যার কোডটি লিখুন। কোড না এলে আবার পাঠান।"
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
          label="৬ সংখ্যার কোড"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          placeholder="••••••"
        />

        {message ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        {resent ? (
          <AppText variant="caption" className="text-primary">
            নতুন কোড পাঠানো হয়েছে।
          </AppText>
        ) : null}

        <PrimaryButton
          label="যাচাই করুন"
          loading={isLoading}
          disabled={!email || code.length !== 6}
          onPress={handleSubmit}
          icon={<Ionicons name="shield-checkmark-outline" size={22} color={colors.white} />}
        />

        <SecondaryButton
          label="আবার কোড পাঠান"
          disabled={!email || resending}
          onPress={() => resend({ email: email.trim() })}
        />
      </View>
    </AuthScaffold>
  );
}
