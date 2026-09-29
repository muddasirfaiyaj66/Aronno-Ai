import { useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { userFacingError } from "@/lib/userFacingError";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import { useSubmitSpecialistDocsMutation } from "@/services/api";
import type { AuthUser } from "@/store/authSlice";

type Slot = "certificate" | "nid";

const STATUS_BN = {
  none: "সনদ ও এনআইডি জমা দিন",
  pending: "অ্যাডমিন দেখছেন",
  approved: "অনুমোদিত বিশেষজ্ঞ",
  rejected: "আবার জমা দিন",
} as const;

function pickSource(onPick: (uri: string) => void) {
  Alert.alert("ছবি যোগ করুন", "ক্যামেরা অথবা গ্যালারি", [
    {
      text: "ক্যামেরা",
      onPress: () => {
        void (async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            if (!perm.canAskAgain) void Linking.openSettings();
            return;
          }
          const picked = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          });
          const uri = picked.assets?.[0]?.uri;
          if (!picked.canceled && uri) onPick(uri);
        })();
      },
    },
    {
      text: "গ্যালারি",
      onPress: () => {
        void (async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            if (!perm.canAskAgain) void Linking.openSettings();
            return;
          }
          const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          });
          const uri = picked.assets?.[0]?.uri;
          if (!picked.canceled && uri) onPick(uri);
        })();
      },
    },
    { text: "বাতিল", style: "cancel" },
  ]);
}

export function SpecialistVerification({ me }: { me: AuthUser }) {
  const status = me.specialistReviewStatus ?? "none";
  const [certificate, setCertificate] = useState<string | null>(me.specialistCertificateUrl ?? null);
  const [nid, setNid] = useState<string | null>(me.specialistNidUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submit, { isLoading }] = useSubmitSpecialistDocsMutation();
  const locked = status === "pending" || status === "approved";
  const ready = !!certificate && !!nid && !locked;

  async function send() {
    if (!certificate || !nid) return;
    setError(null);
    try {
      const certificateUrl = certificate.startsWith("http")
        ? certificate
        : await uploadImageToCloudinary(certificate);
      const nidUrl = nid.startsWith("http") ? nid : await uploadImageToCloudinary(nid);
      await submit({ certificateUrl, nidUrl }).unwrap();
    } catch (err) {
      setError(userFacingError(err, "upload", "জমা দেওয়া যায়নি।"));
    }
  }

  function choose(slot: Slot) {
    if (locked || isLoading) return;
    pickSource((uri) => {
      setError(null);
      if (slot === "certificate") setCertificate(uri);
      else setNid(uri);
    });
  }

  return (
    <View className="gap-3 rounded-3xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="body" className="font-bengali-semibold">
            বিশেষজ্ঞ যাচাই
          </AppText>
          <AppText variant="caption">{STATUS_BN[status]}</AppText>
        </View>
      </View>

      <AppText variant="caption">
        কৃষিবিদ বা সম্প্রসারণ কর্মকর্তা হতে সনদ ও জাতীয় পরিচয়পত্রের ছবি দিন। অ্যাডমিন দেখে অনুমোদন করলে পরামর্শের সারি খুলবে।
      </AppText>

      {status === "rejected" && me.specialistReviewNote ? (
        <View className="rounded-2xl bg-danger-soft px-3 py-3">
          <AppText variant="caption" className="text-danger">
            {me.specialistReviewNote}
          </AppText>
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <DocSlot
          label="সনদ"
          uri={certificate}
          busy={isLoading}
          onPress={() => choose("certificate")}
        />
        <DocSlot label="এনআইডি" uri={nid} busy={isLoading} onPress={() => choose("nid")} />
      </View>

      {error ? (
        <AppText variant="caption" className="text-severity-high">
          {error}
        </AppText>
      ) : null}

      {locked ? null : (
        <PrimaryButton
          label={status === "rejected" ? "আবার জমা দিন" : "যাচাইয়ের জন্য জমা দিন"}
          loading={isLoading}
          disabled={!ready}
          onPress={() => void send()}
        />
      )}
    </View>
  );
}

function DocSlot({
  label,
  uri,
  busy,
  onPress,
}: {
  label: string;
  uri: string | null;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      className="h-36 flex-1 overflow-hidden rounded-2xl border border-border bg-neutral"
    >
      {uri ? (
        <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <View className="flex-1 items-center justify-center gap-1 px-2">
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
          )}
          <AppText variant="caption" className="text-center font-bengali-semibold text-ink">
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
