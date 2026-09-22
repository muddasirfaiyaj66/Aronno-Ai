import { useEffect } from "react";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, tabBar } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName, focusedName: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons
      name={focused ? focusedName : name}
      size={tabBar.iconSize}
      color={color}
    />
  );
}

function tabLabel(title: string) {
  function TabLabel({ color }: { color: string }) {
    return (
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          color,
          fontFamily: "NotoSansBengali_700Bold",
          fontSize: tabBar.labelSize,
          marginBottom: 4,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    );
  }
  return TabLabel;
}

function ScanTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const focused = Boolean(accessibilityState?.selected);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.45]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="স্ক্যান"
      accessibilityState={{ selected: focused }}
      className="-mt-6 items-center"
    >
      <View className="items-center justify-center">
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              height: 68,
              width: 68,
              borderRadius: 34,
              backgroundColor: colors.primary,
            },
            ringStyle,
          ]}
        />
        <View
          className="h-[68px] w-[68px] items-center justify-center rounded-full"
          style={{
            backgroundColor: focused ? colors.primary : colors.tertiary,
            shadowColor: colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            borderWidth: 4,
            borderColor: colors.neutral,
            transform: [{ perspective: 700 }, { rotateX: focused ? "8deg" : "0deg" }],
          }}
        >
          <Ionicons name="camera" size={30} color={colors.white} />
        </View>
      </View>
      <Text
        style={{
          marginTop: 4,
          fontFamily: "NotoSansBengali_700Bold",
          fontSize: tabBar.labelSize,
          color: focused ? colors.primary : colors.muted,
        }}
      >
        স্ক্যান
      </Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: tabBar.height,
          paddingTop: 8,
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "হোম",
          tabBarIcon: tabIcon("home-outline", "home"),
          tabBarLabel: tabLabel("হোম"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "ইতিহাস",
          tabBarIcon: tabIcon("time-outline", "time"),
          tabBarLabel: tabLabel("ইতিহাস"),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "স্ক্যান",
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <ScanTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "সহকারী",
          tabBarIcon: tabIcon("chatbubbles-outline", "chatbubbles"),
          tabBarLabel: tabLabel("সহকারী"),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: "বাজার",
          tabBarIcon: tabIcon("storefront-outline", "storefront"),
          tabBarLabel: tabLabel("বাজার"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "প্রোফাইল",
          tabBarIcon: tabIcon("person-outline", "person"),
          tabBarLabel: tabLabel("আমি"),
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          href: null,
          title: "অফলাইন এআই মডেল",
        }}
      />
    </Tabs>
  );
}
