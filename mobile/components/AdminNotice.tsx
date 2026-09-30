import { useEffect } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { AppText } from "@/components/ui/AppText";
import { useColors } from "@/context/theme";
import {
  consultIdFromPath,
  isIncomingCall,
  setPopupRing,
  stopCallRing,
} from "@/lib/notifications/alert";
import { dismissNotification, useInbox, type AppNotification } from "@/lib/notifications/inbox";
import { useDismissNotificationMutation, useGetConsultQuery } from "@/services/api";

const RANK = { emergency: 0, important: 1, normal: 2 } as const;

function nextNotice(items: AppNotification[]) {
  return items
    .filter((item) => item.popup && !item.dismissed)
    .sort((a, b) => {
      const rank = RANK[a.priority ?? "normal"] - RANK[b.priority ?? "normal"];
      if (rank !== 0) return rank;
      return a.createdAt < b.createdAt ? 1 : -1;
    })[0];
}

export function AdminNotice() {
  const colors = useColors();
  const router = useRouter();
  const { items } = useInbox();
  const [dismiss] = useDismissNotificationMutation();
  const notice = nextNotice(items);
  const incoming = !!notice && isIncomingCall(notice);
  const callId = incoming ? consultIdFromPath(notice.pathname) : "";
  const fresh = !!notice && Date.now() - Date.parse(notice.createdAt) < 90_000;
  const { data: consult, isError: consultMissing } = useGetConsultQuery(callId, {
    skip: !callId,
    pollingInterval: callId ? 3000 : 0,
  });
  const callStillRinging =
    incoming && !consultMissing && (consult?.status === "ringing" || (!consult && fresh));

  useEffect(() => {
    const id = notice?.id ?? "";
    if (incoming && ((consult?.status && consult.status !== "ringing") || consultMissing)) {
      stopCallRing();
      return;
    }
    setPopupRing(callStillRinging, id);
    return () => {
      if (callStillRinging) setPopupRing(false, id);
    };
  }, [callStillRinging, notice?.id, incoming, consult?.status, consultMissing]);

  if (!notice) return null;

  const emergency = notice.priority === "emergency";
  const important = notice.priority === "important";
  const band = emergency ? "#9F1239" : important ? "#B45309" : colors.forest700;
  const label = incoming ? "কল" : emergency ? "জরুরি বার্তা" : important ? "গুরুত্বপূর্ণ" : "আরণ্য থেকে";
  const icon = incoming ? "call" : emergency ? "alert-circle" : important ? "megaphone" : "notifications";

  const close = (silence: boolean) => {
    if (silence && incoming) stopCallRing();
    dismissNotification(notice.id);
    void dismiss(notice.id);
  };

  const open = () => {
    if (incoming && callId) {
      close(false);
      router.push({ pathname: "/(root)/consult/call", params: { consultId: callId } });
      return;
    }
    const path = notice.pathname;
    close(false);
    if (path) router.push(path as Href);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(true)} statusBarTranslucent>
      <Pressable
        onPress={() => close(true)}
        accessibilityRole="button"
        accessibilityLabel="বন্ধ করুন"
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 22,
          backgroundColor: "rgba(8, 20, 16, 0.58)",
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            overflow: "hidden",
            borderRadius: 28,
            backgroundColor: colors.card,
          }}
        >
          <View style={{ backgroundColor: band, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }}>
            <Pressable
              onPress={() => close(true)}
              accessibilityRole="button"
              accessibilityLabel="বন্ধ করুন"
              hitSlop={10}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                height: 36,
                width: 36,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.18)",
              }}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
            <Ionicons name={icon} size={28} color="#FFFFFF" />
            <AppText variant="caption" style={{ color: "rgba(255,255,255,0.86)", marginTop: 12 }}>
              {label}
            </AppText>
            <AppText variant="title" style={{ color: "#FFFFFF", marginTop: 4, paddingRight: 36 }}>
              {notice.title}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: 22, paddingVertical: 18 }}>
            <AppText variant="body" style={{ color: colors.ink, lineHeight: 26 }}>
              {notice.body}
            </AppText>
            <Pressable
              onPress={incoming || notice.pathname ? open : () => close(true)}
              accessibilityRole="button"
              style={{
                marginTop: 18,
                alignItems: "center",
                borderRadius: 16,
                backgroundColor: band,
                paddingVertical: 14,
              }}
            >
              <AppText variant="body" style={{ color: "#FFFFFF" }}>
                {incoming ? "কল ধরুন" : notice.pathname ? "দেখুন" : "বুঝেছি"}
              </AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
