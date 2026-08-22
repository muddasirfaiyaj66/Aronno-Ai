import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { AppText, FieldInput, PrimaryButton } from "@/components/ui";
import { getApiError, useResetPasswordMutation } from "@/services/api";

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
        code: code.trim(),
        password,
      }).unwrap();
      router.replace("/login");
    } catch {
      // banner
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <AppText variant="title">নতুন পাসওয়ার্ড</AppText>
          <AppText variant="bodyLg" className="leading-8 text-muted">
            কোড ও নতুন পাসওয়ার্ড দিন। পাসওয়ার্ড অন্তত ১০ অক্ষর।
          </AppText>
        </View>

        <FieldInput
          label="ইমেইল"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ইমেইল"
        />
        <FieldInput
          label="কোড"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="৬ সংখ্যা"
        />
        <FieldInput
          label="নতুন পাসওয়ার্ড"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
