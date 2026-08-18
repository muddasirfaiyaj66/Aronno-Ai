import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, IconPickerRow, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetProfessionsQuery, useRegisterMutation } from "@/services/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { data: professions = [] } = useGetProfessionsQuery();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [professionSlug, setProfessionSlug] = useState<string | null>(null);
  const [register, { isLoading, error }] = useRegisterMutation();

  const message =
    error && "data" in error
      ? ((error.data as { error?: { message?: string } })?.error?.message ??
        "নিবন্ধন করা যায়নি।")
      : error
        ? "নিবন্ধন করা যায়নি।"
        : null;

  const handleSubmit = async () => {
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        professionSlug: professionSlug ?? undefined,
      }).unwrap();
      router.replace("/(root)/(tabs)");
    } catch {
      // error banner
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerClassName="gap-6 px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <AppText variant="title">নতুন অ্যাকাউন্ট</AppText>
          <AppText variant="body" className="text-muted">
            কৃষক, দোকান মালিক বা অন্য পেশা বেছে নিন
          </AppText>
        </View>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="আপনার নাম"
          placeholderTextColor={colors.muted}
          accessibilityLabel="নাম"
          className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
        />
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
          placeholder="পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর)"
          placeholderTextColor={colors.muted}
          accessibilityLabel="পাসওয়ার্ড"
          className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
        />

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            পেশা
          </AppText>
          <IconPickerRow
            options={professions.map((p) => ({
              id: p.slug,
              label: p.nameBn,
              icon: (
                <Ionicons name="person-outline" size={22} color={colors.primary} />
              ),
            }))}
            value={professionSlug}
            onChange={setProfessionSlug}
          />
        </View>

        {message ? (
          <AppText variant="caption" className="text-severity-high">
            {message}
          </AppText>
        ) : null}

        <PrimaryButton
          label="নিবন্ধন করুন"
          loading={isLoading}
          disabled={!email || !password || !displayName}
          onPress={handleSubmit}
        />

        <Link href="/login" asChild>
          <Pressable accessibilityRole="button">
            <AppText variant="body" className="text-center text-primary">
              আগে থেকে অ্যাকাউন্ট আছে? লগইন
            </AppText>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
