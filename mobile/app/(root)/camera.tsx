import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AIGeneratingShimmer, RetryCard } from "@/components/ui";
import { colors } from "@/constants/theme";

// Full-screen camera, outside the tabs so the bottom bar never covers it.
// The camera is always dark, so its colours are fixed rather than themed.
const GREEN = "#0F766E";
const GREEN_LIGHT = "#5EEAD4";
const WHITE = "#FFFFFF";
const BAR = "rgba(0,0,0,0.55)";

const TITLES: Record<string, string> = {
  receipt: "রসিদের ছবি তুলুন",
  tool: "যন্ত্রের ছবি তুলুন",
  listing: "পণ্যের ছবি তুলুন",
};
const HINTS: Record<string, string> = {
  receipt: "পুরো রসিদ ফ্রেমের ভেতরে রাখুন",
  tool: "যন্ত্রটি ফ্রেমের মাঝে রাখুন",
  listing: "পণ্যটি ফ্রেমের মাঝে রাখুন",
};

export default function PhotoCaptureScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [torch, setTorch] = useState(false);
  const scale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const title = TITLES[flow ?? ""] ?? "পাতার ছবি তুলুন";
  const hint = HINTS[flow ?? ""] ?? "পাতাটি ফ্রেমের মাঝে রাখুন";

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // Receipts need legible small print; leaf / tool photos stay light.
      const photo = await cameraRef.current.takePictureAsync({
        quality: flow === "receipt" ? 0.9 : 0.45,
      });
      if (photo?.uri) setPhotoUri(photo.uri);
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (!photoUri) return;

    // Direct Sell listings don't need AI analysis — return the captured
    // photo straight to the Market tab's Direct Sell form instead of
    // routing through the analyzing screen.
    if (flow === "listing") {
      router.replace({
        pathname: "/(root)/(tabs)/market",
        params: { tab: "direct", photoUri },
      });
      return;
    }

    // Replace, so Back from the result goes to the scan tab, not the camera.
    router.replace({
      pathname: "/(root)/(tabs)/scan/analyzing",
      params: { imageUri: photoUri, source: "photo", flow },
    });
  };

  if (!permission) {
    return (
      <SafeAreaView
        className="flex-1 justify-center bg-neutral px-6"
        edges={["top"]}
      >
        <AIGeneratingShimmer label="ক্যামেরা প্রস্তুত হচ্ছে…" lines={2} />
      </SafeAreaView>
    );
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

  const topBar = (
    <View style={styles.topBar}>
      <RoundButton
        icon="close"
        label="বন্ধ করুন"
        onPress={() => (photoUri ? setPhotoUri(null) : router.back())}
      />
      <View style={styles.titleChip}>
        <Text style={styles.titleText}>
          {photoUri ? "ছবিটি ঠিক আছে?" : title}
        </Text>
      </View>
      {photoUri ? (
        <View style={styles.roundBtn} />
      ) : (
        <RoundButton
          icon={torch ? "flash" : "flash-off"}
          label={torch ? "ফ্ল্যাশ বন্ধ" : "ফ্ল্যাশ চালু"}
          active={torch}
          onPress={() => setTorch((t) => !t)}
        />
      )}
    </View>
  );

  if (photoUri) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
          {topBar}
          <View style={styles.previewBar}>
            <Pressable
              onPress={() => setPhotoUri(null)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.previewBtn,
                styles.retakeBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons name="refresh" size={22} color={WHITE} />
              <Text style={styles.previewText}>আবার তুলুন</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.previewBtn,
                styles.confirmBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={24} color={WHITE} />
              <Text style={styles.previewText}>নিশ্চিত করুন</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
      />
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        {topBar}

        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <View style={styles.hintChip}>
            <Ionicons name="leaf" size={16} color={GREEN_LIGHT} />
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        </View>

        <View style={styles.shutterBar}>
          <Pressable
            onPress={handleCapture}
            onPressIn={() => {
              scale.value = withSpring(0.88);
            }}
            onPressOut={() => {
              scale.value = withSpring(1);
            }}
            accessibilityRole="button"
            accessibilityLabel="ছবি তুলুন"
            disabled={capturing}
            hitSlop={12}
          >
            <Animated.View style={[styles.shutterRing, shutterStyle]}>
              <View style={styles.shutterInner}>
                {capturing ? (
                  <ActivityIndicator color={GREEN} />
                ) : (
                  <Ionicons name="camera" size={32} color={GREEN} />
                )}
              </View>
            </Animated.View>
          </Pressable>
          <Text style={styles.shutterLabel}>ছবি তুলুন</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.roundBtn,
        { backgroundColor: active ? colors.primary : BAR },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} size={22} color={WHITE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  titleChip: {
    backgroundColor: BAR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  titleText: { color: WHITE, fontSize: 16, fontWeight: "700" },
  frameWrap: { alignItems: "center", gap: 14 },
  frame: {
    width: "78%",
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.85)",
  },
  hintChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BAR,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  hintText: { color: WHITE, fontSize: 14 },
  shutterBar: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: BAR,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  shutterRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 5,
    borderColor: GREEN_LIGHT,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN_LIGHT,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterLabel: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },
  previewBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: BAR,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  previewBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retakeBtn: { borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" },
  confirmBtn: { backgroundColor: GREEN },
  previewText: { color: WHITE, fontSize: 16, fontWeight: "700" },
});
