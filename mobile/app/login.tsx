import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useLoginMutation } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();

  const message =
    error && "data" in error
      ? ((error.data as { error?: { message?: string } })?.error?.message ??
        "লগইন করা যায়নি।")
      : error
        ? "লগইন করা যায়নি।"
        : null;

  const handleSubmit = async () => {
    try {
      await login({ email: email.trim(), password }).unwrap();
      router.replace("/(root)/(tabs)");
    } catch {
      // error banner from RTK
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <AppText variant="display">আরণ্য</AppText>
          <AppText variant="bodyLg" className="text-muted">
            লগইন করে আপনার ক্ষেতের যত্ন নিন
          </AppText>
        </View>

        <View className="gap-3">
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
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="পাসওয়ার্ড"
            placeholderTextColor={colors.muted}
            accessibilityLabel="পাসওয়ার্ড"
            className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
          />
        </View>

        {message ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        <PrimaryButton
          label="লগইন"
          loading={isLoading}
          disabled={!email || !password}
          onPress={handleSubmit}
          icon={<Ionicons name="log-in-outline" size={20} color={colors.white} />}
        />

        <Link href="/register" asChild>
          <Pressable accessibilityRole="button">
            <AppText variant="body" className="text-center text-primary">
              নতুন অ্যাকাউন্ট তৈরি করুন
            </AppText>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}
