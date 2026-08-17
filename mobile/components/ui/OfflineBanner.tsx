import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { AppText } from "./AppText";

/**
 * Mounted once at the app root (see app/_layout.tsx) so every screen gets
 * offline awareness without duplicating NetInfo logic per screen.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <SafeAreaView edges={["top"]} className="bg-severity-high-bg">
      <Animated.View
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(200)}
        className="flex-row items-center justify-center gap-2 px-4 py-2.5"
        accessibilityRole="alert"
        accessibilityLabel="ইন্টারনেট সংযোগ নেই"
      >
        <Ionicons name="cloud-offline-outline" size={16} color="#B42318" />
        <AppText
          variant="caption"
          className="font-bengali-semibold text-severity-high"
        >
          ইন্টারনেট সংযোগ নেই
        </AppText>
      </Animated.View>
    </SafeAreaView>
  );
}
