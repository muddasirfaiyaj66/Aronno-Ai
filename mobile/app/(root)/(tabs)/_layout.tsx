import type { ComponentProps } from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";
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

// Bengali labels (esp. প্রোফাইল, স্ক্যান) can be wider than a 1/5-screen tab
// column at 14px on narrow phones — shrink-to-fit instead of clipping.
function tabLabel(title: string) {
  function TabLabel({ color }: { color: string }) {
    return (
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          color,
          fontFamily: "NotoSansBengali_600SemiBold",
          fontSize: tabBar.labelSize,
          marginBottom: 6,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    );
  }
  return TabLabel;
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
          paddingTop: 6,
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
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
        name="scan"
        options={{
          title: "স্ক্যান",
          tabBarIcon: tabIcon("scan-outline", "scan"),
          tabBarLabel: tabLabel("স্ক্যান"),
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
          tabBarLabel: tabLabel("প্রোফাইল"),
        }}
      />
    </Tabs>
  );
}
