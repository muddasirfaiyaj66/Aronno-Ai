import { FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import type { LocalChatSessionRow } from "@/lib/offlineDb/schema";

function formatSessionDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("bn-BD", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Bottom sheet: past chats, switch / delete, new chat, clear current. */
export function HistorySheet({
  visible,
  sessions,
  activeSessionId,
  onClose,
  onSelect,
  onDelete,
  onNew,
  onClearCurrent,
}: {
  visible: boolean;
  sessions: LocalChatSessionRow[];
  activeSessionId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onNew: () => void;
  onClearCurrent: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-black/50"
          accessibilityRole="button"
          accessibilityLabel="বন্ধ করুন"
          onPress={onClose}
        />
        <View
          className="rounded-t-[32px] bg-card px-4 pt-3"
          style={{ maxHeight: "82%", paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="mb-4 items-center">
            <View className="h-1.5 w-12 rounded-full bg-neutral-300" />
          </View>

          <View className="mb-4 flex-row items-center gap-2">
            <View className="flex-1">
              <AppText variant="title" className="text-ink">
                আলোচনার ইতিহাস
              </AppText>
              <AppText variant="caption" className="text-muted">
                {sessions.length ? `${sessions.length.toLocaleString("bn-BD")}টি আলোচনা` : "কোনো আলোচনা নেই"}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="নতুন আলোচনা"
              onPress={onNew}
              className="min-h-[44px] flex-row items-center gap-1.5 rounded-full bg-primary px-4"
            >
              <Ionicons name="add" size={18} color={colors.white} />
              <AppText variant="caption" className="font-bengali-bold" style={{ color: colors.white }}>
                নতুন
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="বন্ধ করুন"
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-neutral-100"
            >
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <FlatList
            data={sessions}
            keyExtractor={(s) => s.localId}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center py-10">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <Ionicons name="chatbubbles-outline" size={26} color={colors.primary} />
                </View>
                <AppText variant="body" className="text-center text-muted">
                  এখনো কোনো আগের আলোচনা নেই
                </AppText>
              </View>
            }
            renderItem={({ item }) => {
              const active = item.localId === activeSessionId;
              return (
                <View
                  className={`flex-row items-center gap-3 rounded-2xl border py-2 pl-3 pr-1.5 ${
                    active ? "border-primary bg-secondary" : "border-border bg-neutral"
                  }`}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${item.titleBn}, ${formatSessionDate(item.updatedAt)}`}
                    onPress={() => onSelect(item.localId)}
                    className="min-h-[48px] min-w-0 flex-1 flex-row items-center gap-3"
                  >
                    <View
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: active ? colors.primary : colors.card }}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={18}
                        color={active ? colors.white : colors.primary}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <AppText
                        variant="body"
                        className="font-bengali-semibold text-ink"
                        numberOfLines={1}
                      >
                        {item.titleBn}
                      </AppText>
                      <AppText variant="caption" className="text-muted" numberOfLines={1}>
                        {formatSessionDate(item.updatedAt)}
                        {active ? " · চলছে" : ""}
                      </AppText>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.titleBn} মুছুন`}
                    onPress={() => onDelete(item.localId, item.titleBn)}
                    hitSlop={4}
                    className="h-11 w-11 items-center justify-center rounded-full bg-danger-soft"
                  >
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </Pressable>
                </View>
              );
            }}
          />

          {activeSessionId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="বর্তমান আলোচনার সব বার্তা মুছুন"
              onPress={onClearCurrent}
              className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl"
            >
              <Ionicons name="trash-bin-outline" size={18} color={colors.danger} />
              <AppText variant="caption" className="font-bengali-semibold text-danger">
                বর্তমান আলোচনার বার্তা মুছুন
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
