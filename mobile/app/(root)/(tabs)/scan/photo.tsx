import { useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PrimaryButton, RetryCard, SecondaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";

export default function PhotoCaptureScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) setPhotoUri(photo.uri);
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (!photoUri) return;
    router.push({
      pathname: "/(root)/(tabs)/scan/analyzing",
      params: { imageUri: photoUri, source: "photo" },
    });
  };

  if (photoUri) {
    return (
      <SafeAreaView className="flex-1 bg-ink" edges={["top", "bottom"]}>
        <Image
          source={{ uri: photoUri }}
          style={{ flex: 1 }}
          resizeMode="cover"
        />
        <View className="flex-row gap-3 bg-ink px-5 py-5">
          <SecondaryButton
            label="আবার তুলুন"
            onPress={() => setPhotoUri(null)}
            className="flex-1"
            icon={<Ionicons name="refresh" size={20} color={colors.ink} />}
          />
          <PrimaryButton
            label="নিশ্চিত করুন"
            onPress={handleConfirm}
            className="flex-1"
            icon={<Ionicons name="checkmark" size={20} color={colors.white} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return <SafeAreaView className="flex-1 bg-neutral" edges={["top"]} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-neutral px-6"
        edges={["top"]}
      >
        <RetryCard
          message="ছবি তুলতে ক্যামেরা ব্যবহারের অনুমতি প্রয়োজন।"
          onRetry={requestPermission}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={["top", "bottom"]}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View className="items-center bg-ink px-5 py-6">
        <Pressable
          onPress={handleCapture}
          accessibilityRole="button"
          accessibilityLabel="ছবি তুলুন"
          disabled={capturing}
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/70 bg-white/20"
          style={{ opacity: capturing ? 0.6 : 1 }}
        >
          <View className="h-16 w-16 rounded-full bg-white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
