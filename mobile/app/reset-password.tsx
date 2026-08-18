import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
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
          <AppText variant="body" className="text-muted">
            ইমেইলের কোড ও নতুন পাসওয়ার্ড দিন
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
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="৬ সংখ্যার কোড"
          placeholderTextColor={colors.muted}
          accessibilityLabel="রিসেট কোড"
          className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="নতুন পাসওয়ার্ড"
          placeholderTextColor={colors.muted}
          accessibilityLabel="নতুন পাসওয়ার্ড"
          className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
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
