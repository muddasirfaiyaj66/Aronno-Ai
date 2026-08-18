import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PrimaryButton, SecondaryButton } from "@/components/ui";
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
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <AppText variant="title">ইমেইল যাচাই করুন</AppText>
          <AppText variant="body" className="text-muted">
            ইনবক্সে পাঠানো ৬ সংখ্যার কোড দিন
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
          accessibilityLabel="যাচাই কোড"
          className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
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
          icon={<Ionicons name="shield-checkmark-outline" size={20} color={colors.white} />}
        />

        <SecondaryButton
          label="আবার কোড পাঠান"
          disabled={!email || resending}
          onPress={() => resend({ email: email.trim() })}
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
