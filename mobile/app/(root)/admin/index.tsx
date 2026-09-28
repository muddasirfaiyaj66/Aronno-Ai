import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter, type Href } from "expo-router";
import { AppText, FieldInput, PrimaryButton, ScreenHeader } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useCreateAdminMutation,
  useGetAdminUsersQuery,
  useGetMeQuery,
  usePatchAdminRoleMutation,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import {
  validateDisplayNameBn,
  validateEmailBn,
  validatePasswordBn,
} from "@/lib/authValidation";

function isStaff(slug?: string) {
  return slug === "ADMIN" || slug === "SUPERADMIN";
}

export default function AdminStaffScreen() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useGetMeQuery();
  const skip = !isStaff(me?.role.slug);
  const { data: users = [] } = useGetAdminUsersQuery(undefined, { skip });
  const [createAdmin, { isLoading: creating, error: createError, reset: resetCreate }] =
    useCreateAdminMutation();
  const [patchRole, { isLoading: promoting }] = usePatchAdminRoleMutation();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!meLoading && !isStaff(me?.role.slug)) {
    return <Redirect href={"/(root)/(tabs)/profile" as unknown as Href} />;
  }

  const errorMessage =
    localError ??
    (createError
      ? userFacingError(createError, "generic", "অ্যাডমিন তৈরি করা যায়নি।")
      : undefined);

  const canSubmit =
    displayName.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  const handleCreate = async () => {
    const clientMsg =
      validateDisplayNameBn(displayName) ??
      validateEmailBn(email) ??
      validatePasswordBn(password);
    if (clientMsg) {
      setLocalError(clientMsg);
      setDoneMessage(null);
      resetCreate();
      return;
    }
    setLocalError(null);
    setDoneMessage(null);
    try {
      await createAdmin({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      }).unwrap();
      setDisplayName("");
      setEmail("");
      setPassword("");
      setDoneMessage("নতুন অ্যাডমিন তৈরি হয়েছে। তারা এখন লগইন করতে পারবেন।");
    } catch {
      // banner
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="অ্যাডমিন"
        subtitle="নতুন অ্যাডমিন তৈরি করুন — তারাও আরও অ্যাডমিন যোগ করতে পারবেন"
        onBack={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 py-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4 rounded-3xl bg-card p-4">
          <AppText variant="body" className="font-bengali-bold text-ink">
            নতুন অ্যাডমিন
          </AppText>
          <FieldInput
            label="নাম"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="অ্যাডমিনের নাম"
          />
          <FieldInput
            label="ইমেইল"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="ইমেইল"
          />
          <FieldInput
            label="পাসওয়ার্ড"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="নতুন পাসওয়ার্ড"
            hint="কমপক্ষে ১০ অক্ষর, বড় ও ছোট হাতের অক্ষর, সংখ্যা ও প্রতীক"
          />
          {errorMessage ? (
            <AppText variant="caption" className="text-severity-high">
              {errorMessage}
            </AppText>
          ) : null}
          {doneMessage ? (
            <AppText variant="caption" className="text-severity-low">
              {doneMessage}
            </AppText>
          ) : null}
          <PrimaryButton
            label="অ্যাডমিন তৈরি করুন"
            onPress={handleCreate}
            disabled={!canSubmit}
            loading={creating}
          />
        </View>

        <AppText variant="title">ব্যবহারকারী</AppText>
        {users.map((user) => (
          <View key={user.id} className="gap-2 rounded-3xl bg-card p-4">
            <AppText variant="bodyLg" className="font-bengali-bold text-ink">
              {user.displayName}
            </AppText>
            <AppText variant="caption">{user.email}</AppText>
            <AppText variant="caption" className="text-primary">
              {user.role.nameBn} ({user.role.slug})
            </AppText>
            {user.role.slug === "USER" ? (
              <Pressable
                onPress={() => patchRole({ id: user.id, roleSlug: "ADMIN" })}
                disabled={promoting}
                accessibilityRole="button"
                className="mt-1 min-h-touch items-center justify-center rounded-2xl bg-secondary px-4"
              >
                <AppText variant="body" className="font-bengali-bold text-primary">
                  অ্যাডমিন করুন
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ))}
        {users.length === 0 ? (
          <AppText variant="caption" style={{ color: colors.muted }}>
            এখনো কোনো ব্যবহারকারী নেই।
          </AppText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
