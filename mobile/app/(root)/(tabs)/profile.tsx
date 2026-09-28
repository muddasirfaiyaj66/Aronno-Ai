import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import {
  AppText,
  DistrictPicker,
  FieldInput,
  FormSection,
  IconPickerRow,
  PrimaryButton,
  SegmentedTabs,
  SettingsGroup,
  SettingsRow,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useTheme } from "@/context/theme";
import {
  useGetDistrictsQuery,
  useGetMeQuery,
  useGetProfessionsQuery,
  useGetSessionsQuery,
  useLogoutMutation,
  usePatchMeMutation,
  useRevokeSessionMutation,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { validateBdPhoneBn } from "@/lib/authValidation";
import { matchDistrictSlug, useFarmLocation } from "@/hooks/useFarmLocation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import { deviceLabel } from "@/lib/deviceLabel";
import * as ImagePicker from "expo-image-picker";

type IconName = ComponentProps<typeof Ionicons>["name"];

const PROFESSION_ICONS: Record<string, IconName> = {
  farmer: "leaf-outline",
  shop_owner: "storefront-outline",
  agronomist: "flask-outline",
  trader: "cart-outline",
  extension_officer: "briefcase-outline",
  other: "person-outline",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { data: me, refetch: refetchMe } = useGetMeQuery();
  const { data: professions = [], refetch: refetchProfessions } =
    useGetProfessionsQuery();
  const { data: districts = [], refetch: refetchDistricts } =
    useGetDistrictsQuery();
  const [logout] = useLogoutMutation();
  const [patchMe, { isLoading, error }] = usePatchMeMutation();
  const { preference, setPreference } = useTheme();
  const { data: sessionData } = useGetSessionsQuery();
  const [revokeSession, { isLoading: revoking }] = useRevokeSessionMutation();
  const location = useFarmLocation();
  const [editing, setEditing] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [professionSlug, setProfessionSlug] = useState<string | null>(null);
  const [districtSlug, setDistrictSlug] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? "");
    setPhone(me.phone ?? "");
    setProfessionSlug(me.profession?.slug ?? null);
    setDistrictSlug(me.district?.slug ?? null);
  }, [me]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refetchMe(),
      refetchProfessions(),
      refetchDistricts(),
    ]);
  }, [refetchMe, refetchProfessions, refetchDistricts]);

  const { refreshControl } = usePullToRefresh(refreshAll);

  const message =
    localError ??
    (error
      ? userFacingError(error, "generic", "প্রোফাইল সংরক্ষণ করা যায়নি।")
      : undefined);
  const canSave = displayName.trim().length >= 2;
  const districtName =
    districts.find((d) => d.slug === districtSlug)?.nameBn ?? undefined;
  const professionName =
    professions.find((p) => p.slug === professionSlug)?.nameBn ?? undefined;

  const handleSave = async () => {
    if (!canSave) return;
    setSaved(false);
    const phoneCheck = validateBdPhoneBn(phone);
    if (!phoneCheck.ok) {
      setLocalError(phoneCheck.message ?? null);
      return;
    }
    setLocalError(null);
    try {
      await patchMe({
        displayName: displayName.trim(),
        phone: phoneCheck.value,
        professionSlug: professionSlug ?? undefined,
        districtSlug: districtSlug ?? undefined,
      }).unwrap();
      if (phoneCheck.value) setPhone(phoneCheck.value);
      setSaved(true);
    } catch {
      // banner
    }
  };

  const useCurrentPlace = async () => {
    setLocating(true);
    setLocationHint(null);
    try {
      const found = await location.refresh(true);
      if (!found) {
        setLocationHint(
          "অবস্থান পাওয়া যায়নি। ফোনের লোকেশন চালু করে আবার চেষ্টা করুন।",
        );
        return;
      }
      const slug = matchDistrictSlug(found.labelBn, districts);
      if (slug) {
        setDistrictSlug(slug);
        setLocationHint(
          `${districts.find((d) => d.slug === slug)?.nameBn ?? found.labelBn} — এখন সংরক্ষণ করুন।`,
        );
      } else {
        setLocationHint(
          found.labelBn
            ? `${found.labelBn} — তালিকা থেকে জেলা বেছে নিন।`
            : "অবস্থান পাওয়া গেছে। জেলা বেছে নিন, তারপর সংরক্ষণ করুন।",
        );
      }
    } finally {
      setLocating(false);
    }
  };

  const applyPickedPhoto = async (uri: string) => {
    setUploadingPhoto(true);
    setPhotoError(null);
    setSaved(false);
    try {
      const avatarUrl = await uploadImageToCloudinary(uri);
      await patchMe({ avatarUrl }).unwrap();
      setSaved(true);
    } catch (err) {
      setPhotoError(userFacingError(err, "upload"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoError("গ্যালারির অনুমতি দিন, তারপর আবার চাপুন।");
      if (!perm.canAskAgain) void Linking.openSettings();
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    await applyPickedPhoto(picked.assets[0].uri);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPhotoError("ক্যামেরার অনুমতি দিন, তারপর আবার চাপুন।");
      if (!perm.canAskAgain) void Linking.openSettings();
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    await applyPickedPhoto(picked.assets[0].uri);
  };

  const pickAvatar = () => {
    setPhotoError(null);
    Alert.alert("প্রোফাইল ছবি", "ছবি তুলুন অথবা গ্যালারি থেকে বেছে নিন", [
      {
        text: "ক্যামেরা",
        onPress: () => {
          void pickFromCamera();
        },
      },
      {
        text: "গ্যালারি",
        onPress: () => {
          void pickFromLibrary();
        },
      },
      { text: "বাতিল", style: "cancel" },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert("লগ আউট", "অ্যাকাউন্ট থেকে বের হতে চান?", [
      { text: "না", style: "cancel" },
      {
        text: "লগ আউট",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await logout();
            router.replace("/login");
          })();
        },
      },
    ]);
  };

  const initial = (me?.displayName ?? me?.email ?? "ক").trim().charAt(0);
  const isStaff =
    me?.role.slug === "ADMIN" || me?.role.slug === "SUPERADMIN";

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View
        className="border-b border-border bg-card px-5 pb-3 pt-2"
        accessibilityRole="header"
      >
        <AppText variant="title" className="text-ink">
          প্রোফাইল
        </AppText>
        <AppText variant="caption" className="mt-0.5 text-muted">
          ব্যক্তিগত তথ্য ও অ্যাপ সেটিংস
        </AppText>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 py-4 pb-28"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {/* Identity hero */}
          <View className="overflow-hidden rounded-3xl border border-border bg-card">
            <View
              className="px-5 pb-6 pt-8"
              style={{ backgroundColor: colors.forest900 }}
            >
              <Pressable
                onPress={pickAvatar}
                accessibilityRole="button"
                accessibilityLabel="প্রোফাইল ছবি পরিবর্তন করুন"
                className="items-center"
              >
                <View>
                  {me?.avatarUrl ? (
                    <Image
                      source={{ uri: me.avatarUrl }}
                      accessibilityLabel="প্রোফাইল ছবি"
                      style={{
                        height: 96,
                        width: 96,
                        borderRadius: 48,
                        borderWidth: 3,
                        borderColor: colors.white,
                      }}
                    />
                  ) : (
                    <View
                      className="h-24 w-24 items-center justify-center rounded-full border-[3px] border-white"
                      style={{ backgroundColor: colors.tertiary }}
                    >
                      <AppText variant="display" className="text-white">
                        {initial}
                      </AppText>
                    </View>
                  )}
                  <View
                    className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white"
                    style={{ backgroundColor: colors.forest700 }}
                    importantForAccessibility="no"
                  >
                    {uploadingPhoto ? (
                      <Ionicons
                        name="hourglass"
                        size={14}
                        color={colors.white}
                      />
                    ) : (
                      <Ionicons name="camera" size={14} color={colors.white} />
                    )}
                  </View>
                </View>
              </Pressable>
              <AppText
                variant="title"
                className="mt-4 text-center text-white"
                numberOfLines={1}
              >
                {me?.displayName || "নাম যোগ করুন"}
              </AppText>
              {me?.email ? (
                <AppText
                  variant="caption"
                  className="mt-1 text-center text-white/85"
                >
                  {me.email}
                </AppText>
              ) : null}
            </View>

            {(professionName || districtName) && (
              <View className="flex-row flex-wrap items-center justify-center gap-2 border-t border-border px-4 py-3">
                {professionName ? (
                  <View
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: colors.secondary }}
                  >
                    <AppText
                      variant="caption"
                      className="font-bengali-semibold text-primary"
                    >
                      {professionName}
                    </AppText>
                  </View>
                ) : null}
                {districtName ? (
                  <View className="rounded-full bg-neutral px-3 py-1.5">
                    <AppText
                      variant="caption"
                      className="font-bengali-semibold text-ink"
                    >
                      {districtName}
                    </AppText>
                  </View>
                ) : null}
              </View>
            )}
            {photoError ? (
              <AppText
                variant="caption"
                className="px-4 pb-3 text-center text-severity-high"
                accessibilityLiveRegion="polite"
              >
                {photoError}
              </AppText>
            ) : uploadingPhoto ? (
              <AppText
                variant="caption"
                className="px-4 pb-3 text-center text-muted"
              >
                ছবি আপলোড হচ্ছে…
              </AppText>
            ) : null}
          </View>

          {editing ? (
          <>
          <FormSection title="ব্যক্তিগত তথ্য">
            <FieldInput
              label="নাম"
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t);
                setLocalError(null);
                setSaved(false);
              }}
              autoComplete="name"
              textContentType="name"
              placeholder="যেমন: করিম মিয়া"
            />
            <FieldInput
              label="মোবাইল"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setLocalError(null);
                setSaved(false);
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={14}
              hint="১১ সংখ্যা, যেমন 01712345678"
              placeholder="01712345678"
              error={
                localError && localError.includes("মোবাইল")
                  ? localError
                  : undefined
              }
            />
          </FormSection>

          <FormSection title="পেশা">
            <IconPickerRow
              options={professions.map((p) => ({
                id: p.slug,
                label: p.nameBn,
                icon: (
                  <Ionicons
                    name={PROFESSION_ICONS[p.slug] ?? "person-outline"}
                    size={20}
                    color={colors.primary}
                  />
                ),
              }))}
              value={professionSlug}
              onChange={(id) => {
                setProfessionSlug(id);
                setSaved(false);
              }}
            />
          </FormSection>

          <FormSection title="জেলা">
            <DistrictPicker
              districts={districts}
              value={districtSlug}
              onChange={(slug) => {
                setDistrictSlug(slug);
                setSaved(false);
              }}
            />
            <Pressable
              onPress={() => {
                void useCurrentPlace();
              }}
              disabled={locating}
              accessibilityRole="button"
              accessibilityState={{ busy: locating }}
              accessibilityLabel="বর্তমান অবস্থান ব্যবহার করুন"
              className="min-h-touch flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 active:bg-secondary"
            >
              <Ionicons
                name="navigate-outline"
                size={18}
                color={colors.primary}
              />
              <AppText
                variant="body"
                className="font-bengali-semibold text-primary"
              >
                {locating
                  ? "অবস্থান খোঁজা হচ্ছে…"
                  : "বর্তমান অবস্থান ব্যবহার"}
              </AppText>
            </Pressable>
            {locationHint ? (
              <AppText
                variant="caption"
                className="text-primary"
                accessibilityLiveRegion="polite"
              >
                {locationHint}
              </AppText>
            ) : null}
          </FormSection>

          {message && !message.includes("মোবাইল") ? (
            <AppText
              variant="caption"
              className="px-1 text-severity-high"
              accessibilityLiveRegion="assertive"
            >
              {message}
            </AppText>
          ) : saved ? (
            <AppText
              variant="caption"
              className="px-1 text-primary"
              accessibilityLiveRegion="polite"
            >
              প্রোফাইল সংরক্ষণ হয়েছে।
            </AppText>
          ) : null}

          <PrimaryButton
            label="পরিবর্তন সংরক্ষণ"
            loading={isLoading}
            disabled={!canSave}
            onPress={handleSave}
          />
          <Pressable onPress={() => setEditing(false)} accessibilityRole="button">
            <AppText variant="caption" className="text-center text-muted">
              বন্ধ করুন
            </AppText>
          </Pressable>
          </>
          ) : (
          <SettingsGroup
            title="অ্যাকাউন্ট"
            footer="নাম, মোবাইল, পেশা ও জেলা এখান থেকে বদলানো যায়।"
          >
            <SettingsRow
              label="নাম"
              value={me?.displayName || "যোগ করুন"}
              icon="person-outline"
            />
            <SettingsRow
              label="ইমেইল"
              value={me?.email}
              subtitle={me?.emailVerifiedAt ? "যাচাই করা" : "যাচাই বাকি"}
              icon="mail-outline"
            />
            <SettingsRow
              label="মোবাইল"
              value={me?.phone || "যোগ করুন"}
              icon="call-outline"
            />
            <SettingsRow
              label="পেশা"
              value={professionName || "বেছে নিন"}
              icon="briefcase-outline"
            />
            <SettingsRow
              label="জেলা"
              value={districtName || "বেছে নিন"}
              icon="location-outline"
            />
            <SettingsRow
              label="তথ্য সম্পাদনা"
              icon="create-outline"
              last
              onPress={() => setEditing(true)}
            />
          </SettingsGroup>
          )}

          <SettingsGroup
            title="লগইন করা ডিভাইস"
            footer="এই ফোন এবং অন্য জায়গা থেকে খোলা অ্যাকাউন্ট।"
          >
            {!sessionData?.sessions.some((s) => s.current) ? (
              <SettingsRow
                label={deviceLabel()}
                subtitle="এখন এই ডিভাইসে লগইন আছে"
                icon="phone-portrait-outline"
                last={!sessionData?.sessions.length}
              />
            ) : null}
            {(sessionData?.sessions ?? []).map((session, index, all) => (
              <SettingsRow
                key={session.id}
                label={session.deviceName}
                subtitle={
                  session.current
                    ? "এই ডিভাইস"
                    : new Date(session.createdAt).toLocaleString("bn-BD", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                }
                icon={session.current ? "phone-portrait" : "phone-portrait-outline"}
                last={index === all.length - 1}
                showChevron={false}
                right={
                  session.current ? (
                    <AppText variant="caption" className="font-bengali-semibold text-primary">
                      সক্রিয়
                    </AppText>
                  ) : (
                    <Pressable
                      onPress={() => {
                        void revokeSession(session.id);
                      }}
                      disabled={revoking}
                      accessibilityRole="button"
                      accessibilityLabel="এই ডিভাইস থেকে বের করুন"
                    >
                      <AppText variant="caption" className="font-bengali-semibold text-severity-high">
                        বের করুন
                      </AppText>
                    </Pressable>
                  )
                }
              />
            ))}
          </SettingsGroup>

          <SettingsGroup
            title="চেহারা"
            footer="হালকা, গাঢ়, অথবা ফোনের সেটিংস অনুসরণ করুন।"
          >
            <View className="px-3 py-3">
              <SegmentedTabs
                options={[
                  { id: "system", label: "ফোন" },
                  { id: "light", label: "হালকা" },
                  { id: "dark", label: "গাঢ়" },
                ]}
                value={preference}
                onChange={setPreference}
              />
            </View>
          </SettingsGroup>

          <SettingsGroup
            title="অফলাইন সরঞ্জাম"
            footer="ইন্টারনেট ছাড়া চ্যাট ও স্ক্যানের জন্য মডেল ডাউনলোড করুন।"
          >
            <SettingsRow
              label="মডেল ম্যানেজার"
              subtitle="জেমা ও কণ্ঠ মডেল"
              icon="cloud-download-outline"
              onPress={() => router.push("/(root)/(tabs)/models")}
            />
            <SettingsRow
              label="অফলাইন অবস্থা"
              subtitle="মডেল ও সিঙ্ক দেখুন"
              icon="pulse-outline"
              onPress={() => router.push("/(root)/offline-debug")}
              last={!isStaff}
            />
            {isStaff ? (
              <SettingsRow
                label="অ্যাডমিন প্যানেল"
                subtitle="নতুন অ্যাডমিন তৈরি"
                icon="people-outline"
                onPress={() =>
                  router.push("/(root)/admin" as unknown as Href)
                }
                last
              />
            ) : null}
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
              label="লগ আউট"
              icon="log-out-outline"
              destructive
              showChevron={false}
              last
              onPress={confirmLogout}
            />
          </SettingsGroup>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
