import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <AppText variant="title">ইমেইল যাচাই করুন</AppText>
          <AppText variant="bodyLg" className="leading-8 text-muted">
            ইনবক্সে পাঠানো ৬ সংখ্যার কোডটি বড় করে লিখুন।
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
          label="৬ সংখ্যার কোড"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
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
