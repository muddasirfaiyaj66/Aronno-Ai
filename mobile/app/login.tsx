import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AppText, FieldInput, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { getApiError, useLoginMutation } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();

  const apiError = getApiError(error);
  const message = apiError.message;

  const handleSubmit = async () => {
    try {
      await login({ email: email.trim(), password }).unwrap();
      router.replace("/(root)/(tabs)");
    } catch (err) {
      if (getApiError(err).code === "EMAIL_UNVERIFIED") {
        router.push({
          pathname: "/verify-email",
          params: { email: email.trim() },
        } as unknown as Href);
      }
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

        {message && apiError.code !== "EMAIL_UNVERIFIED" ? (
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
      </View>
    </AuthScaffold>
  );
}
