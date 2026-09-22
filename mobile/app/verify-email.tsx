import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AppText, FieldInput, PrimaryButton, SecondaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { sanitizeOtpInput } from "@/utils/otp";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email: emailParam, resent: resentParam } = useLocalSearchParams<{
    email?: string;
    resent?: string;
  }>();
  const lockedEmail = emailParam ? normalizeEmail(emailParam) : "";
  const [email, setEmail] = useState(lockedEmail);
  const [code, setCode] = useState("");
  const [resendNotice, setResendNotice] = useState(resentParam === "1");
  const [verify, { isLoading, error, reset }] = useVerifyEmailMutation();
  const [resend, { isLoading: resending, error: resendError }] =
    useResendVerificationMutation();

  const message = error
    ? userFacingError(error, "auth", "কোড যাচাই করা যায়নি।")
    : resendError
      ? userFacingError(resendError, "auth", "কোড পাঠানো যায়নি।")
      : undefined;
  const emailLocked = lockedEmail.length > 0;

  useEffect(() => {
    if (resentParam === "1") {
      setResendNotice(true);
      setCode("");
    }
  }, [resentParam]);

  const handleSubmit = async () => {
    setResendNotice(false);
    reset();
    const normalizedCode = sanitizeOtpInput(code);
    if (normalizedCode.length !== 6) return;
    try {
      await verify({
        email: normalizeEmail(email),
        code: normalizedCode,
      }).unwrap();
      router.replace("/(root)/(tabs)");
    } catch {
      // banner
    }
  };

  const handleResend = async () => {
    setResendNotice(false);
    reset();
    try {
      await resend({ email: normalizeEmail(email) }).unwrap();
      setCode("");
      setResendNotice(true);
    } catch {
      // banner
    }
  };

  return (
    <AuthScaffold
      title="ইমেইল যাচাই করুন"
      subtitle="ইনবক্সে পাঠানো ৬ সংখ্যার কোডটি লিখুন। কোড ১৫ মিনিটের মধ্যে ব্যবহার করুন।"
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
          editable={!emailLocked}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="ইমেইল"
        />
        <FieldInput
          label="৬ সংখ্যার কোড"
          value={code}
          onChangeText={(text) => setCode(sanitizeOtpInput(text))}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="••••••"
        />

        {message ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        {resendNotice ? (
          <AppText variant="caption" className="text-primary">
            নতুন কোড পাঠানো হয়েছে। ইনবক্সের সর্বশেষ কোডটি লিখুন।
          </AppText>
        ) : null}

        <PrimaryButton
          label="যাচাই করুন"
          loading={isLoading}
          disabled={!email || sanitizeOtpInput(code).length !== 6}
          onPress={handleSubmit}
          icon={<Ionicons name="shield-checkmark-outline" size={22} color={colors.white} />}
        />

        <SecondaryButton
          label="আবার কোড পাঠান"
          disabled={!email || resending}
          onPress={handleResend}
        />
      </View>
    </AuthScaffold>
  );
}
