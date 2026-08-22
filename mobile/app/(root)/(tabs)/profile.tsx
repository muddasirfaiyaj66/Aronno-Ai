import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
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
  IconPickerRow,
  LoanStatusCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  getApiError,
  useGetCurrentLoanQuery,
  useGetDistrictsQuery,
  useGetMeQuery,
  useGetProfessionsQuery,
  useLogoutMutation,
  usePatchMeMutation,
} from "@/services/api";
import { matchDistrictSlug, useFarmLocation } from "@/hooks/useFarmLocation";
import { uploadImageToCloudinary } from "@/services/cloudinary";
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
  const { data: me } = useGetMeQuery();
  const { data: loan } = useGetCurrentLoanQuery();
  const { data: professions = [] } = useGetProfessionsQuery();
  const { data: districts = [] } = useGetDistrictsQuery();
  const [logout] = useLogoutMutation();
  const [patchMe, { isLoading, error }] = usePatchMeMutation();
  const location = useFarmLocation();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [professionSlug, setProfessionSlug] = useState<string | null>(null);
  const [districtSlug, setDistrictSlug] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? "");
    setPhone(me.phone ?? "");
    setProfessionSlug(me.profession?.slug ?? null);
    setDistrictSlug(me.district?.slug ?? null);
  }, [me]);

  const message = getApiError(error).message;
  const canSave = displayName.trim().length >= 2;

  const handleSave = async () => {
    if (!canSave) return;
    setSaved(false);
    try {
      const trimmedPhone = phone.trim();
      await patchMe({
        displayName: displayName.trim(),
        phone: trimmedPhone.length >= 6 ? trimmedPhone : undefined,
        professionSlug: professionSlug ?? undefined,
        districtSlug: districtSlug ?? undefined,
      }).unwrap();
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
        setLocationHint("অবস্থান পাওয়া যায়নি। ফোনের লোকেশন চালু করে আবার চেষ্টা করুন।");
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
      setPhotoError(getApiError(err).message ?? "ছবি আপলোড করা যায়নি।");
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

  const initial = (me?.displayName ?? me?.email ?? "ক").trim().charAt(0);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader title="আমি" subtitle="নাম, ফোন, পেশা ও জেলা আপডেট করুন" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-5 py-5 pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center rounded-[28px] border border-neutral-200 bg-white px-5 py-6">
            <Pressable
              onPress={pickAvatar}
              accessibilityRole="button"
              accessibilityLabel="প্রোফাইল ছবি আপলোড"
              className="items-center"
            >
              <View>
                {me?.avatarUrl ? (
                  <Image
                    source={{ uri: me.avatarUrl }}
                    style={{ height: 88, width: 88, borderRadius: 44 }}
                  />
                ) : (
                  <View
                    className="h-[88px] w-[88px] items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <AppText variant="title" className="text-white">
                      {initial}
                    </AppText>
                  </View>
                )}
                <View
                  className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white"
                  style={{ backgroundColor: colors.tertiary }}
                >
                  <Ionicons name="camera" size={14} color={colors.white} />
                </View>
              </View>
              <AppText variant="caption" className="mt-3 font-bengali-semibold text-primary">
                {uploadingPhoto ? "ছবি তোলা হচ্ছে…" : "ছবি যোগ করুন"}
              </AppText>
            </Pressable>
            {photoError ? (
              <AppText variant="caption" className="mt-2 text-center text-severity-high">
                {photoError}
              </AppText>
            ) : null}
            <AppText variant="body" className="mt-2 text-muted">
              {me?.email}
            </AppText>
          </View>

          <View className="gap-5 rounded-[28px] border border-neutral-200 bg-white px-5 py-5">
            <FieldInput
              label="আপনার নাম"
              value={displayName}
              onChangeText={setDisplayName}
              autoComplete="name"
              textContentType="name"
              placeholder="যেমন: করিম মিয়া"
            />
            <FieldInput
              label="ফোন"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="০১৭xxxxxxxx"
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

            <View className="gap-3">
              <AppText variant="body" className="font-bengali-bold text-ink">
                জেলা
              </AppText>
              <DistrictPicker
                districts={districts}
                value={districtSlug}
                onChange={setDistrictSlug}
              />
              {districts.length > 0 ? (
                <AppText variant="caption">
                  বাংলাদেশের {districts.length} জেলা — খুঁজে বেছে নিন
                </AppText>
              ) : (
                <AppText variant="caption">জেলার তালিকা আনা হচ্ছে…</AppText>
              )}
              <SecondaryButton
                label={locating ? "অবস্থান খোঁজা হচ্ছে…" : "বর্তমান অবস্থান ব্যবহার করুন"}
                onPress={useCurrentPlace}
                disabled={locating}
                icon={
                  <Ionicons name="navigate-outline" size={20} color={colors.ink} />
                }
              />
              {locationHint ? (
                <AppText variant="caption" className="text-primary">
                  {locationHint}
                </AppText>
              ) : null}
            </View>

            {message ? (
              <AppText variant="caption" className="text-severity-high">
                {message}
              </AppText>
            ) : saved ? (
              <AppText variant="caption" className="text-primary">
                প্রোফাইল সংরক্ষণ হয়েছে।
              </AppText>
            ) : null}

            <PrimaryButton
              label="সংরক্ষণ করুন"
              loading={isLoading}
              disabled={!canSave}
              onPress={handleSave}
            />
          </View>

          <View className="gap-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              কৃষি ঋণ
            </AppText>
            {loan ? (
              <LoanStatusCard
                title="কৃষি ঋণ"
                amount={loan.amountBn}
                status={loan.status}
                nextPaymentLabel="পরবর্তী কিস্তি"
                nextPaymentDate={loan.nextPaymentDateBn}
              />
            ) : (
              <AppText variant="caption">এখনো কোনো ঋণ নেই।</AppText>
            )}
            <SecondaryButton
              label="নতুন আবেদন"
              onPress={() => router.push("/(root)/loan/overview")}
              icon={
                <Ionicons name="add-circle-outline" size={20} color={colors.ink} />
              }
            />
          </View>

          {me?.role.slug === "ADMIN" || me?.role.slug === "SUPERADMIN" ? (
            <SecondaryButton
              label="অ্যাডমিন তৈরি"
              onPress={() => router.push("/(root)/admin" as unknown as Href)}
              icon={<Ionicons name="people-outline" size={20} color={colors.ink} />}
            />
          ) : null}

          <Pressable
            onPress={async () => {
              await logout();
              router.replace("/login");
            }}
            accessibilityRole="button"
            accessibilityLabel="লগ আউট"
            className="min-h-touch items-center justify-center py-3"
          >
            <AppText variant="body" className="font-bengali-bold text-severity-high">
              লগ আউট
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
