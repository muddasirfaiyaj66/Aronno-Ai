import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { AppText, EmptyState, ScreenHeader } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  hydrateInbox,
  markAllNotificationsRead,
  markNotificationRead,
  useInbox,
  type NotificationKind,
} from "@/lib/notifications/inbox";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "@/services/api";

const ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  heat: "warning-outline",
  weather: "rainy-outline",
  scan: "leaf-outline",
  order: "bag-handle-outline",
  admin: "megaphone-outline",
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unread } = useInbox();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();

  useEffect(() => {
    void hydrateInbox();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="বিজ্ঞপ্তি"
        subtitle={unread > 0 ? `${unread}টি নতুন` : "রোগ, আবহাওয়া, স্ক্যান ও অর্ডার"}
        onBack={() => router.back()}
      />
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            icon={<Ionicons name="notifications-outline" size={32} color={colors.primary} />}
            message="এখন কোনো বিজ্ঞপ্তি নেই। আপনি হিটম্যাপের এলাকায় ঢুকলে, আবহাওয়া খারাপ হলে, বা অর্ডার বদলালে এখানে দেখাবে।"
            ctaLabel="হোমে ফিরুন"
            onCta={() => router.back()}
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-3 px-4 py-4 pb-16">
          {unread > 0 ? (
            <Pressable
              onPress={() => {
                void markAllNotificationsRead();
                void markAll();
              }}
              accessibilityRole="button"
              className="self-end"
            >
              <AppText variant="caption" className="font-bengali-semibold text-primary">
                সব পড়া হয়েছে
              </AppText>
            </Pressable>
          ) : null}
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                void markNotificationRead(item.id);
                void markRead(item.id);
                if (!item.pathname) return;
                router.push({
                  pathname: item.pathname,
                  params: item.params,
                } as Href);
              }}
              accessibilityRole="button"
              className="flex-row gap-3 rounded-3xl border border-border bg-card px-4 py-4"
              style={{ opacity: item.read ? 0.72 : 1 }}
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: colors.secondary }}
              >
                <Ionicons name={ICON[item.kind]} size={20} color={colors.primary} />
              </View>
              <View className="min-w-0 flex-1">
                {item.kind === "admin" ? (
                  <AppText variant="caption" className="text-primary">
                    {item.priority === "emergency"
                      ? "জরুরি"
                      : item.priority === "important"
                        ? "গুরুত্বপূর্ণ"
                        : "অ্যাডমিন"}
                  </AppText>
                ) : null}
                <AppText variant="body" className="font-bengali-bold text-ink">
                  {item.title}
                </AppText>
                <AppText variant="caption" className="mt-1 leading-5">
                  {item.body}
                </AppText>
              </View>
              {!item.read ? (
                <View className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
