import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AppText, FieldInput, IconPickerRow, PrimaryButton } from "@/components/ui";
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
      router.replace({
        pathname: "/verify-email",
        params: { email: email.trim() },
      } as unknown as Href);
    } catch {
      // error banner
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#064E3B", "#047857"]}
        style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 }}
      >
        <AppText variant="caption" className="font-bengali-bold text-leaf-300">
          আরণ্য
        </AppText>
        <AppText variant="title" className="mt-3 text-white">
          নতুন অ্যাকাউন্ট
        </AppText>
        <AppText variant="body" className="mt-1 text-secondary">
          কৃষক, দোকান মালিক — যে পেশাই হোক, বড় অক্ষরে সহজ ফর্ম।
        </AppText>
      </LinearGradient>

      <ScrollView
        className="-mt-3 flex-1 rounded-t-[32px] bg-neutral"
        contentContainerClassName="gap-5 px-6 pb-10 pt-8"
        keyboardShouldPersistTaps="handled"
      >
        <FieldInput
          label="আপনার নাম"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="যেমন: করিম মিয়া"
        />
        <FieldInput
          label="ইমেইল"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ইমেইল লিখুন"
        />
        <FieldInput
          label="পাসওয়ার্ড"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          hint="কমপক্ষে ১০ অক্ষর, বড় হাত, ছোট হাত, সংখ্যা ও চিহ্ন"
          placeholder="নতুন পাসওয়ার্ড"
        />

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            পেশা বেছে নিন
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
          label="অ্যাকাউন্ট তৈরি করুন"
          loading={isLoading}
          disabled={!email || !password || !displayName}
          onPress={handleSubmit}
        />

        <Link href="/login" asChild>
          <Pressable accessibilityRole="button" className="min-h-touch items-center justify-center">
            <AppText variant="bodyLg" className="font-bengali-bold text-primary">
              আগে থেকে অ্যাকাউন্ট আছে? লগইন
            </AppText>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
