import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type TiltPressableProps = PressableProps & {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function TiltPressable({
  children,
  contentStyle,
  onPressIn,
  onPressOut,
  ...props
}: TiltPressableProps) {
  const tilt = useSharedValue(0);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${tilt.value * 10}deg` },
      { rotateY: `${tilt.value * -7}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Pressable
      onPressIn={(e) => {
        tilt.value = withSpring(1, { damping: 14, stiffness: 220 });
        scale.value = withSpring(0.97, { damping: 16, stiffness: 280 });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        tilt.value = withSpring(0, { damping: 12, stiffness: 180 });
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        onPressOut?.(e);
      }}
      {...props}
    >
      <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
