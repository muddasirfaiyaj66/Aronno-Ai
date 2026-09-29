import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { colors } from "@/constants/theme";

export function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 280, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View
      accessible
      accessibilityLabel="উত্তর লেখা হচ্ছে"
      className="flex-row items-center gap-1.5 py-2"
    >
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            opacity: v,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
          }}
        />
      ))}
    </View>
  );
}
