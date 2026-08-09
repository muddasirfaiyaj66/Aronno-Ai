import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PrimaryButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function PrimaryButton({
  label,
  loading = false,
  icon,
  disabled,
  className = "",
  onPressIn,
  onPressOut,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      onPressIn={(e) => {
        scale.value = withSpring(0.97, { damping: 16, stiffness: 320 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        onPressOut?.(e);
      }}
      style={[
        animatedStyle,
        {
          minHeight: 56,
          borderRadius: 18,
          backgroundColor: colors.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 20,
          opacity: isDisabled ? 0.5 : 1,
          shadowColor: colors.primary,
          shadowOpacity: 0.28,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
        },
      ]}
      className={className}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          {icon}
          <AppText variant="bodyLg" className="font-bengali-bold text-white">
            {label}
          </AppText>
        </>
      )}
    </AnimatedPressable>
  );
}
