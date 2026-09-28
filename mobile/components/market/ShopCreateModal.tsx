import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { DistrictPicker } from "@/components/ui/DistrictPicker";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ProductImagePicker, type ImageItem } from "@/components/ui/ProductImagePicker";
import { colors } from "@/constants/theme";
import {
  useCreateShopMutation,
  useGetDistrictsQuery,
  useUpdateMyShopMutation,
} from "@/services/api";
import type { ShopData } from "@/types/market";

type ShopCreateModalProps = {
  visible: boolean;
  onClose: () => void;
  existingShop?: ShopData | null;
};

export function ShopCreateModal({
  visible,
  onClose,
  existingShop,
}: ShopCreateModalProps) {
  const { data: districts = [] } = useGetDistrictsQuery();
  const [createShop, { isLoading: creating }] = useCreateShopMutation();
  const [updateShop, { isLoading: updating }] = useUpdateMyShopMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (existingShop) {
      setName(existingShop.name ?? "");
      setDescription(existingShop.description ?? "");
      setPhone(existingShop.phone ?? "");
      setDistrictId(existingShop.districtId ?? "");
      setUpazila(existingShop.upazila ?? "");
      setAddress(existingShop.address ?? "");
      setImages(
        existingShop.logoUrl ? [{ url: existingShop.logoUrl }] : [],
      );
    } else {
      setName("");
      setDescription("");
      setPhone("");
      setDistrictId(districts[0]?.id ?? districts[0]?.slug ?? "");
      setUpazila("");
      setAddress("");
      setImages([]);
    }
    setErrorMsg(null);
  }, [existingShop, visible, districts]);

  useEffect(() => {
    if (!districtId && districts.length > 0) {
      setDistrictId(districts[0].id ?? districts[0].slug);
    }
  }, [districts, districtId]);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !!districtId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMsg(null);
    try {
      const logoUrl = images[0]?.url;
      if (existingShop) {
        await updateShop({
          name: name.trim(),
          description: description.trim(),
          phone: phone.trim(),
          districtId,
          upazila: upazila.trim(),
          address: address.trim(),
          logoUrl,
        }).unwrap();
      } else {
        await createShop({
          name: name.trim(),
          description: description.trim(),
          phone: phone.trim(),
          districtId,
          upazila: upazila.trim(),
          address: address.trim(),
          logoUrl,
        }).unwrap();
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "দোকান তৈরি বা তথ্য সংরক্ষণে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
      setErrorMsg(msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-black/50 justify-end"
      >
        <View className="max-h-[90%] rounded-t-3xl bg-neutral px-5 py-6">
          <View className="flex-row items-center justify-between border-b border-border pb-3">
            <AppText variant="subtitle" className="font-bengali-bold text-ink">
              {existingShop ? "দোকান সম্পাদনা করুন" : "আপনার দোকান খুলুন"}
            </AppText>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-card"
            >
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-4 py-4 pb-8"
            keyboardShouldPersistTaps="handled"
          >
            {/* Shop Name */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                দোকানের নাম <AppText className="text-red-600">*</AppText>
              </AppText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="যেমনঃ সবুজ বাংলা এগ্রো ট্রেডার্স"
                placeholderTextColor={colors.muted}
                className="min-h-touch-lg rounded-2xl bg-card px-4 font-bengali-medium text-body-lg text-ink"
              />
            </View>

            {/* Shop Description */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                দোকানের বিবরণ
              </AppText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder="আপনার দোকান ও কৃষি পণ্যের তথ্য লিখুন..."
                placeholderTextColor={colors.muted}
                className="min-h-[90px] rounded-2xl bg-card p-4 font-bengali-medium text-body text-ink"
              />
            </View>

            {/* Shop Logo / Photo */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                দোকানের ছবি / লোগো
              </AppText>
              <ProductImagePicker images={images} onChange={setImages} maxImages={1} />
            </View>

            {/* District */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                জেলা <AppText className="text-red-600">*</AppText>
              </AppText>
              <DistrictPicker
                districts={districts}
                value={districtId}
                onChange={setDistrictId}
              />
            </View>

            {/* Upazila */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                উপজেলা
              </AppText>
              <TextInput
                value={upazila}
                onChangeText={setUpazila}
                placeholder="যেমনঃ ধামরাই"
                placeholderTextColor={colors.muted}
                className="min-h-touch-lg rounded-2xl bg-card px-4 font-bengali-medium text-body-lg text-ink"
              />
            </View>

            {/* Address */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                ঠিকানা (বাজার/রাস্তা/দোকান নং)
              </AppText>
              <TextInput
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                placeholder="যেমনঃ ধামরাই বাজার রোড, দোকান নং ৪"
                placeholderTextColor={colors.muted}
                className="min-h-[70px] rounded-2xl bg-card p-4 font-bengali-medium text-body-lg text-ink"
              />
            </View>

            {/* Phone */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                যোগাযোগের ফোন নম্বর <AppText className="text-red-600">*</AppText>
              </AppText>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="যেমনঃ 01700000000"
                placeholderTextColor={colors.muted}
                className="min-h-touch-lg rounded-2xl bg-card px-4 font-bengali-medium text-body-lg text-ink"
              />
            </View>

            {errorMsg ? (
              <AppText variant="caption" className="font-bengali-medium text-red-600">
                {errorMsg}
              </AppText>
            ) : null}

            <PrimaryButton
              label={existingShop ? "সংরক্ষণ করুন" : "দোকান তৈরি করুন"}
              onPress={handleSubmit}
              loading={creating || updating}
              disabled={!canSubmit}
              className="mt-2"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

