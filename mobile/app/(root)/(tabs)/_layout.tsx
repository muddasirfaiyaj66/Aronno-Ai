import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="স্ক্যান"
      accessibilityState={{ selected: focused }}
      className="-mt-6 items-center"
    >
      <View
        className="h-[68px] w-[68px] items-center justify-center rounded-full"
        style={{
          backgroundColor: focused ? colors.harvest : colors.primary,
          shadowColor: colors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
          borderWidth: 4,
          borderColor: colors.neutral,
        }}
      >
        <Ionicons name="camera" size={30} color={colors.white} />
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
    </Tabs>
  );
}
