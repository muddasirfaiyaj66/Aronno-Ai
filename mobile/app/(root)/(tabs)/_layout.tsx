import type { ComponentProps } from "react";
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

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: "NotoSansBengali_600SemiBold",
          fontSize: tabBar.labelSize,
          marginBottom: 6,
        },
        tabBarStyle: {
          height: tabBar.height,
          paddingTop: 6,
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "হোম",
          tabBarIcon: tabIcon("home-outline", "home"),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "স্ক্যান",
          tabBarIcon: tabIcon("scan-outline", "scan"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "ইতিহাস",
          tabBarIcon: tabIcon("time-outline", "time"),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: "বাজার",
          tabBarIcon: tabIcon("storefront-outline", "storefront"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "প্রোফাইল",
          tabBarIcon: tabIcon("person-outline", "person"),
        }}
      />
    </Tabs>
  );
}
