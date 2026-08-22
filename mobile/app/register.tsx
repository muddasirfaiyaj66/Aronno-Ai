import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AppText, FieldInput, IconPickerRow, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetProfessionsQuery, useRegisterMutation } from "@/services/api";

type IconName = ComponentProps<typeof Ionicons>["name"];

const PROFESSION_ICONS: Record<string, IconName> = {
  farmer: "leaf-outline",
  shop_owner: "storefront-outline",
  agronomist: "flask-outline",
  trader: "cart-outline",
  extension_officer: "briefcase-outline",
  other: "person-outline",
};

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
    <AuthScaffold
      title="অ্যাকাউন্ট তৈরি করুন"
      subtitle="নাম, ইমেইল ও পেশা দিয়ে শুরু করুন — যাচাই কোড ইমেইলে যাবে।"
      footer={
        <Link href="/login" asChild>
          <Pressable
            accessibilityRole="button"
            className="min-h-touch flex-row items-center justify-center gap-1"
          >
            <AppText variant="body" className="text-muted">
              আগে থেকে অ্যাকাউন্ট আছে?
            </AppText>
            <AppText variant="body" className="font-bengali-bold text-primary">
              লগইন
            </AppText>
          </Pressable>
        </Link>
      }
    >
      <View className="gap-5">
        <FieldInput
          label="আপনার নাম"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          textContentType="name"
          placeholder="যেমন: করিম মিয়া"
        />
        <FieldInput
          label="ইমেইল"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="ইমেইল লিখুন"
        />
        <FieldInput
          label="পাসওয়ার্ড"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
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
                <Ionicons
                  name={PROFESSION_ICONS[p.slug] ?? "person-outline"}
                  size={22}
                  color={colors.primary}
                />
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
      </View>
    </AuthScaffold>
  );
}
