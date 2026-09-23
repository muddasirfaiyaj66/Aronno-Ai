import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { DistrictPicker } from "@/components/ui/DistrictPicker";
import { IconPickerRow } from "@/components/ui/IconPickerRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ProductImagePicker, type ImageItem } from "@/components/ui/ProductImagePicker";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { colors } from "@/constants/theme";
import {
  useCreateProductMutation,
  useGetDistrictsQuery,
  useUpdateProductMutation,
} from "@/services/api";

type ProductCategoryKey =
  | "crops"
  | "vegetables"
  | "fruits"
  | "seeds"
  | "fertilizers"
  | "pesticides"
  | "tools"
  | "fish"
  | "dairy"
  | "eggs"
  | "other";

type ProductUnitKey = "kg" | "mon" | "ton" | "piece" | "liter" | "bag";

const CATEGORIES: { id: ProductCategoryKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "crops", label: "শস্য ও ফসল", icon: "leaf-outline" },
  { id: "vegetables", label: "সবজি", icon: "basket-outline" },
  { id: "fruits", label: "ফলমূল", icon: "nutrition-outline" },
  { id: "seeds", label: "বীজ", icon: "flower-outline" },
  { id: "fertilizers", label: "সার", icon: "flask-outline" },
  { id: "pesticides", label: "কীটনাশক", icon: "shield-outline" },
  { id: "tools", label: "যন্ত্রপাতি ও সরঞ্জাম", icon: "construct-outline" },
  { id: "fish", label: "মাছ", icon: "fish-outline" },
  { id: "dairy", label: "দুধ ও দুগ্ধজাত পণ্য", icon: "water-outline" },
  { id: "eggs", label: "ডিম", icon: "egg-outline" },
  { id: "other", label: "অন্যান্য", icon: "cube-outline" },
];

const UNITS: { id: ProductUnitKey; label: string }[] = [
  { id: "kg", label: "কেজি" },
  { id: "mon", label: "মণ" },
  { id: "ton", label: "টন" },
  { id: "piece", label: "পিস" },
  { id: "liter", label: "লিটার" },
  { id: "bag", label: "বস্তা" },
];

type AddProductModalProps = {
  visible: boolean;
  onClose: () => void;
  existingProduct?: any | null;
};

export function AddProductModal({
  visible,
  onClose,
  existingProduct,
}: AddProductModalProps) {
  const { data: districts = [] } = useGetDistrictsQuery();
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategoryKey>("crops");
  const [description, setDescription] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [unit, setUnit] = useState<ProductUnitKey>("kg");
  const [availableQuantity, setAvailableQuantity] = useState("");
  const [minOrderQuantity, setMinOrderQuantity] = useState("1");
  const [districtId, setDistrictId] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isOrganic, setIsOrganic] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (existingProduct) {
      setName(existingProduct.name ?? "");
      setCategory(existingProduct.category ?? "crops");
      setDescription(existingProduct.description ?? "");
      setPricePerUnit(String(existingProduct.pricePerUnit ?? ""));
      setUnit(existingProduct.unit ?? "kg");
      setAvailableQuantity(String(existingProduct.availableQuantity ?? ""));
      setMinOrderQuantity(String(existingProduct.minOrderQuantity ?? "1"));
      setDistrictId(existingProduct.districtId ?? "");
      setImages(existingProduct.images ?? []);
      setIsOrganic(existingProduct.isOrganic ?? false);
    } else {
      setName("");
      setCategory("crops");
      setDescription("");
      setPricePerUnit("");
      setUnit("kg");
      setAvailableQuantity("");
      setMinOrderQuantity("1");
      setDistrictId(districts[0]?.slug ?? "");
      setImages([]);
      setIsOrganic(false);
    }
    setErrorMsg(null);
  }, [existingProduct, visible, districts]);

  useEffect(() => {
    if (!districtId && districts.length > 0) {
      setDistrictId(districts[0].slug);
    }
  }, [districts, districtId]);

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    Number(pricePerUnit) > 0 &&
    Number(availableQuantity) >= 0 &&
    !!districtId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMsg(null);
    try {
      if (existingProduct) {
        await updateProduct({
          id: existingProduct.id,
          name: name.trim(),
          category,
          description: description.trim(),
          pricePerUnit: Number(pricePerUnit),
          unit,
          availableQuantity: Number(availableQuantity),
          minOrderQuantity: Number(minOrderQuantity) || 1,
          districtId,
          images,
          isOrganic,
        }).unwrap();
      } else {
        await createProduct({
          name: name.trim(),
          category,
          description: description.trim(),
          pricePerUnit: Number(pricePerUnit),
          unit,
          availableQuantity: Number(availableQuantity),
          minOrderQuantity: Number(minOrderQuantity) || 1,
          districtId,
          images,
          isOrganic,
        }).unwrap();
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "পণ্য যোগ বা হালনাগাদ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
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
              {existingProduct ? "পণ্য সম্পাদনা করুন" : "নতুন পণ্য যোগ করুন"}
            </AppText>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-white"
            >
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-4 py-4"
            keyboardShouldPersistTaps="handled"
          >
            {/* Category */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                পণ্যের ক্যাটাগরি <AppText className="text-red-600">*</AppText>
              </AppText>
              <IconPickerRow
                options={CATEGORIES.map((c) => ({
                  id: c.id,
                  label: c.label,
                  icon: <Ionicons name={c.icon} size={20} color={colors.primary} />,
                }))}
                value={category}
                onChange={(id) => setCategory(id as ProductCategoryKey)}
              />
            </View>

            {/* Product Name */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                পণ্যের নাম <AppText className="text-red-600">*</AppText>
              </AppText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="যেমনঃ ব্রি ধান ২৯ বা দেশি লাল টমেটো"
                placeholderTextColor={colors.muted}
                className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
              />
            </View>

            {/* Price & Unit */}
            <View className="flex-row gap-3">
              <View className="flex-1 gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  দাম প্রতি ইউনিট (৳) <AppText className="text-red-600">*</AppText>
                </AppText>
                <TextInput
                  value={pricePerUnit}
                  onChangeText={setPricePerUnit}
                  keyboardType="numeric"
                  placeholder="যেমনঃ ৬০"
                  placeholderTextColor={colors.muted}
                  className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                />
              </View>
              <View className="w-1/3 gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  ইউনিট <AppText className="text-red-600">*</AppText>
                </AppText>
                <SegmentedTabs options={UNITS} value={unit} onChange={(u) => setUnit(u as ProductUnitKey)} />
              </View>
            </View>

            {/* Quantity & Min Order */}
            <View className="flex-row gap-3">
              <View className="flex-1 gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  মজুদ পরিমাণ <AppText className="text-red-600">*</AppText>
                </AppText>
                <TextInput
                  value={availableQuantity}
                  onChangeText={setAvailableQuantity}
                  keyboardType="numeric"
                  placeholder="যেমনঃ ৫০০"
                  placeholderTextColor={colors.muted}
                  className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                />
              </View>
              <View className="flex-1 gap-2">
                <AppText variant="body" className="font-bengali-bold text-ink">
                  সর্বনিম্ন অর্ডারের পরিমাণ
                </AppText>
                <TextInput
                  value={minOrderQuantity}
                  onChangeText={setMinOrderQuantity}
                  keyboardType="numeric"
                  placeholder="যেমনঃ ১"
                  placeholderTextColor={colors.muted}
                  className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                />
              </View>
            </View>

            {/* Product Description */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                পণ্যের বিবরণ <AppText className="text-red-600">*</AppText>
              </AppText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholder="পণ্যের বৈশিষ্ট্য, মান বা ডেলিভারির তথ্য লিখুন..."
                placeholderTextColor={colors.muted}
                className="min-h-[90px] rounded-2xl bg-white p-4 font-bengali-medium text-body text-ink"
              />
            </View>

            {/* Product Images */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                পণ্যের ছবিসমূহ (সর্বোচ্চ ৫টি)
              </AppText>
              <ProductImagePicker images={images} onChange={setImages} maxImages={5} />
            </View>

            {/* District Location */}
            <View className="gap-2">
              <AppText variant="body" className="font-bengali-bold text-ink">
                জেলা <AppText className="text-red-600">*</AppText>
              </AppText>
              <DistrictPicker districts={districts} value={districtId} onChange={setDistrictId} />
            </View>

            {/* Organic Toggle */}
            <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="leaf" size={20} color={colors.primary} />
                <AppText variant="body" className="font-bengali-semibold text-ink">
                  জৈব / অর্গানিক পণ্য
                </AppText>
              </View>
              <Switch
                value={isOrganic}
                onValueChange={setIsOrganic}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {errorMsg ? (
              <AppText variant="caption" className="font-bengali-medium text-red-600">
                {errorMsg}
              </AppText>
            ) : null}

            <PrimaryButton
              label={existingProduct ? "হালনাগাদ করুন" : "পণ্য প্রকাশ করুন"}
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


