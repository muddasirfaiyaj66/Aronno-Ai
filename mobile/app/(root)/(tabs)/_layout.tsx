import { useEffect } from "react";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
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

const LEFT_TABS = ["index", "history"] as const;
const RIGHT_TABS = ["assistant", "market", "profile"] as const;
const SCAN_ROUTE = "scan";

const TAB_META: Record<
  string,
  { label: string; icon: IconName; iconFocused: IconName }
> = {
  index: { label: "হোম", icon: "home-outline", iconFocused: "home" },
  history: { label: "ইতিহাস", icon: "time-outline", iconFocused: "time" },
  assistant: {
    label: "চ্যাট",
    icon: "chatbubbles-outline",
    iconFocused: "chatbubbles",
  },
  market: {
    label: "বাজার",
    icon: "storefront-outline",
    iconFocused: "storefront",
  },
  profile: { label: "আমি", icon: "person-outline", iconFocused: "person" },
};

function ScanFab({
  focused,
  onPress,
}: {
  focused: boolean;
  onPress: () => void;
}) {
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
      style={{ alignItems: "center", marginTop: -22, width: 68 }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              height: 64,
              width: 64,
              borderRadius: 32,
              backgroundColor: colors.primary,
            },
            ringStyle,
          ]}
        />
        <View
          style={{
            height: 64,
            width: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: focused ? colors.primary : colors.tertiary,
            shadowColor: colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            borderWidth: 4,
            borderColor: colors.white,
          }}
        >
          <Ionicons name="camera" size={28} color={colors.white} />
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

function SideTab({
  routeName,
  routeKey,
  focused,
  navigation,
}: {
  routeName: string;
  routeKey: string;
  focused: boolean;
  navigation: BottomTabBarProps["navigation"];
}) {
  const meta = TAB_META[routeName];
  if (!meta) return null;

  const color = focused ? colors.primary : colors.muted;

  const onPress = () => {
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 8,
        minWidth: 0,
      }}
    >
      <View
        style={{
          height: 32,
          minWidth: 46,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? colors.secondary : "transparent",
        }}
      >
        <Ionicons
          name={focused ? meta.iconFocused : meta.icon}
          size={tabBar.iconSize}
          color={color}
        />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          marginTop: 2,
          marginBottom: 2,
          width: "100%",
          color,
          fontFamily: "NotoSansBengali_700Bold",
          fontSize: tabBar.labelSize,
          textAlign: "center",
        }}
      >
        {meta.label}
      </Text>
    </Pressable>
  );
}

function CenteredTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const bottomInset = Math.max(insets.bottom, 8);
  const routesByName = Object.fromEntries(
    state.routes.map((r) => [r.name, r]),
  );

  const scanRoute = routesByName[SCAN_ROUTE];
  const scanFocused = scanRoute
    ? state.index === state.routes.indexOf(scanRoute)
    : false;

  const onScanPress = () => {
    if (!scanRoute) return;
    const event = navigation.emit({
      type: "tabPress",
      target: scanRoute.key,
      canPreventDefault: true,
    });
    if (!scanFocused && !event.defaultPrevented) {
      navigation.navigate(SCAN_ROUTE);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.neutral,
        paddingHorizontal: 12,
        paddingTop: 18,
        paddingBottom: bottomInset,
      }}
    >
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        height: 74,
        backgroundColor: colors.white,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.forest900,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}
    >
      {/* Equal-width sides keep Scan geometrically centered */}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        {LEFT_TABS.map((name) => {
          const route = routesByName[name];
          if (!route) return null;
          return (
            <SideTab
              key={route.key}
              routeName={name}
              routeKey={route.key}
              focused={state.index === state.routes.indexOf(route)}
              navigation={navigation}
            />
          );
        })}
      </View>

      <ScanFab focused={scanFocused} onPress={onScanPress} />

      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        {RIGHT_TABS.map((name) => {
          const route = routesByName[name];
          if (!route) return null;
          return (
            <SideTab
              key={route.key}
              routeName={name}
              routeKey={route.key}
              focused={state.index === state.routes.indexOf(route)}
              navigation={navigation}
            />
          );
        })}
      </View>
    </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CenteredTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "হোম" }} />
      <Tabs.Screen name="history" options={{ title: "ইতিহাস" }} />
      <Tabs.Screen name="scan" options={{ title: "স্ক্যান" }} />
      <Tabs.Screen
        name="assistant"
        options={{ title: "সহকারী", tabBarHideOnKeyboard: true }}
      />
      <Tabs.Screen name="market" options={{ title: "বাজার" }} />
      <Tabs.Screen name="profile" options={{ title: "প্রোফাইল" }} />
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
