import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AppText } from "@/components/ui/AppText";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { colors } from "@/constants/theme";
import { uploadImageWithMeta } from "@/services/cloudinary";

export type ImageItem = {
  url: string;
  publicId?: string;
};

type ProductImagePickerProps = {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  maxImages?: number;
};

export function ProductImagePicker({
  images,
  onChange,
  maxImages = 5,
}: ProductImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUploadUri = async (uri: string) => {
    if (images.length >= maxImages) return;
    setErrorMsg(null);
    setUploading(true);
    try {
      const { url, publicId } = await uploadImageWithMeta(uri);
      onChange([...images, { url, publicId: publicId || undefined }]);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "ছবি আপলোড করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMsg("ছবি বাছাই করতে গ্যালারি অ্যাক্সেস করার অনুমতি দিন।");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
    });

    if (!result.canceled && result.assets.length > 0) {
      for (const asset of result.assets) {
        if (images.length < maxImages) {
          await handleUploadUri(asset.uri);
        }
      }
    }
  };

  const takeWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setErrorMsg("ছবি তুলতে ক্যামেরা ব্যবহারের অনুমতি দিন।");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      await handleUploadUri(result.assets[0].uri);
    }
  };

  const handleRemove = (index: number) => {
    Alert.alert("ছবি সরান", "এই ছবিটি সরিয়ে দিতে চান?", [
      { text: "বাতিল", style: "cancel" },
      {
        text: "সরান",
        style: "destructive",
        onPress: () => {
          const updated = images.filter((_, i) => i !== index);
          onChange(updated);
        },
      },
    ]);
  };

  return (
    <View className="gap-3">
      {/* Uploaded image previews */}
      {images.length > 0 ? (
        <View className="flex-row flex-wrap gap-3">
          {images.map((img, idx) => (
            <View key={img.url + idx} className="relative h-24 w-24 rounded-2xl bg-neutral">
              <Image
                source={{ uri: img.url }}
                className="h-full w-full rounded-2xl"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => handleRemove(idx)}
                accessibilityRole="button"
                accessibilityLabel="ছবি মুছুন"
                className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-red-600 shadow-sm"
              >
                <Ionicons name="close" size={16} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Upload in progress */}
      {uploading ? (
        <View className="min-h-touch-lg flex-row items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <ActivityIndicator color={colors.primary} size="small" />
          <AppText variant="caption" className="font-bengali-medium text-primary">
            ছবি আপলোড করা হচ্ছে...
          </AppText>
        </View>
      ) : null}

      {/* Camera / Gallery buttons */}
      {images.length < maxImages && !uploading ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <SecondaryButton
              label="ক্যামেরা"
              onPress={takeWithCamera}
              icon={<Ionicons name="camera-outline" size={18} color={colors.ink} />}
            />
          </View>
          <View className="flex-1">
            <SecondaryButton
              label="গ্যালারি"
              onPress={pickFromGallery}
              icon={<Ionicons name="images-outline" size={18} color={colors.ink} />}
            />
          </View>
        </View>
      ) : null}

      {images.length >= maxImages ? (
        <AppText variant="caption" className="text-muted">
          সর্বোচ্চ {maxImages}টি ছবি যোগ করা হয়েছে।
        </AppText>
      ) : null}

      {errorMsg ? (
        <AppText variant="caption" className="font-bengali-medium text-red-600">
          {errorMsg}
        </AppText>
      ) : null}
    </View>
  );
}
