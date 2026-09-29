import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/theme";
import type { LivePhase } from "@/lib/offlineChat/liveConversation";

export const PHASE_COPY: Record<
  Exclude<LivePhase, "idle">,
  { title: string; hint: string }
> = {
  listening: { title: "শুনছি", hint: "স্বাভাবিক গলায় বাংলায় বলুন" },
  hearing: { title: "শুনছি…", hint: "থামলেই উত্তর দেওয়া হবে" },
  thinking: { title: "প্রস্তুত হচ্ছে", hint: "একটু অপেক্ষা করুন" },
  speaking: { title: "বলছি", hint: "শেষ হলে আবার শোনা যাবে" },
};

/** Breathing mic orb for hands-free voice chat. */
export function VoiceOrb({
  phase,
  level,
}: {
  phase: LivePhase;
  level: Animated.Value;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const active = phase !== "idle";

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      ring.setValue(0);
      return;
    }
    const half = phase === "hearing" ? 420 : 900;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    ringLoop.start();
    return () => {
      loop.stop();
      ringLoop.stop();
    };
  }, [active, phase, pulse, ring]);

  const tone =
    phase === "hearing"
      ? colors.leaf400
      : phase === "thinking"
        ? colors.harvest
        : phase === "speaking"
          ? colors.tertiary
          : colors.primary;

  const breathe = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, phase === "hearing" ? 1.18 : 1.08],
  });
  const levelScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const micScale = Animated.multiply(breathe, levelScale);
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.38] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  const icon: keyof typeof Ionicons.glyphMap =
    phase === "thinking" ? "sparkles" : phase === "speaking" ? "volume-high" : "mic";

  return (
    <View
      accessible
      accessibilityLabel={
        phase === "idle"
          ? "মাইক্রোফোন"
          : PHASE_COPY[phase as Exclude<LivePhase, "idle">].title
      }
      className="h-56 w-56 items-center justify-center"
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 172,
          height: 172,
          borderRadius: 86,
          borderWidth: 2,
          borderColor: tone,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: 172,
          height: 172,
          borderRadius: 86,
          backgroundColor: tone,
          opacity: haloOpacity,
          transform: [{ scale: micScale }],
        }}
      />
      <Animated.View style={{ transform: [{ scale: micScale }] }}>
        <LinearGradient
          colors={[colors.forest600, colors.forest900]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 116,
            height: 116,
            borderRadius: 58,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={46} color={colors.white} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
