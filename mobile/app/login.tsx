import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppText, FieldInput, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { getApiError, useLoginMutation } from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();
  const apiError = error ? getApiError(error) : undefined;

  const message = error
    ? userFacingError(error, "auth", "ইমেইল বা পাসওয়ার্ড ঠিক নেই।")
    : undefined;

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await login({ email: normalizedEmail, password });

    if ("data" in result && result.data) {
      router.replace("/(root)/(tabs)");
      return;
    }

    // Backend issues a fresh OTP whenever an unverified user tries to log in,
    // so we just need to forward the user to the verify screen.
    if ("error" in result && getApiError(result.error).code === "EMAIL_UNVERIFIED") {
      router.push({
        pathname: "/verify-email",
        params: { email: normalizedEmail, resent: "1" },
      } as unknown as Href);
    }
  };

  return (
    <AuthScaffold
      title="লগইন করুন"
      subtitle="আপনার ক্ষেত, বাজার ও পরামর্শ — একই জায়গায়।"
      footer={
        <Link href="/register" asChild>
          <Pressable
            accessibilityRole="button"
            className="min-h-touch flex-row items-center justify-center gap-1"
          >
            <AppText variant="body" className="text-muted">
              নতুন ব্যবহারকারী?
            </AppText>
            <AppText variant="body" className="font-bengali-bold text-primary">
              অ্যাকাউন্ট তৈরি করুন
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
          placeholder="আপনার ইমেইল লিখুন"
        />
        <FieldInput
          label="পাসওয়ার্ড"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          placeholder="পাসওয়ার্ড লিখুন"
        />

        <Link href={"/forgot-password" as Href} asChild>
          <Pressable accessibilityRole="button" className="self-end">
            <AppText variant="caption" className="font-bengali-bold text-primary">
              পাসওয়ার্ড ভুলে গেছেন?
            </AppText>
          </Pressable>
        </Link>

        {message && apiError?.code !== "EMAIL_UNVERIFIED" ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        <PrimaryButton
          label="লগইন"
          loading={isLoading}
          disabled={!email || !password}
          onPress={handleSubmit}
          icon={<Ionicons name="arrow-forward" size={20} color={colors.white} />}
        />

        <AppText variant="caption" className="text-center text-muted">
          অথবা
        </AppText>
        <GoogleSignInButton />
      </View>
    </AuthScaffold>
  );
}
