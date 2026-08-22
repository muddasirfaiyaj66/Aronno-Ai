import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#064E3B", "#047857"]}
        style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36 }}
      >
        <AppText variant="caption" className="font-bengali-bold text-leaf-300">
          আরণ্য
        </AppText>
        <AppText variant="display" className="mt-4 text-white">
          আপনার ক্ষেতে স্বাগতম
        </AppText>
        <AppText variant="bodyLg" className="mt-2 text-secondary">
          ছবি তুলুন, বাংলায় বলুন, ফলাফল শুনুন।
        </AppText>
      </LinearGradient>

      <View className="-mt-4 flex-1 rounded-t-[32px] bg-neutral px-6 pt-8">
        <View className="gap-5">
          <FieldInput
            label="ইমেইল"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="আপনার ইমেইল লিখুন"
          />
          <FieldInput
            label="পাসওয়ার্ড"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="পাসওয়ার্ড লিখুন"
          />

          {message && apiError.code !== "EMAIL_UNVERIFIED" ? (
            <AppText variant="caption" className="text-severity-high">
              {message}
            </AppText>
          ) : null}

          <PrimaryButton
            label="শুরু করুন"
            loading={isLoading}
            disabled={!email || !password}
            onPress={handleSubmit}
            icon={<Ionicons name="log-in-outline" size={22} color={colors.white} />}
          />

          <Link href={"/forgot-password" as Href} asChild>
            <Pressable accessibilityRole="button" className="min-h-touch items-center justify-center">
              <AppText variant="bodyLg" className="font-bengali-bold text-primary">
                পাসওয়ার্ড ভুলে গেছেন?
              </AppText>
            </Pressable>
          </Link>

          <Link href="/register" asChild>
            <Pressable accessibilityRole="button" className="min-h-touch items-center justify-center">
              <AppText variant="body" className="text-center text-muted">
                নতুন? অ্যাকাউন্ট তৈরি করুন
              </AppText>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
