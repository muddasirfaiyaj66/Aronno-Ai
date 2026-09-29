import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";

/**
 * Pill composer: mic · text · send/stop. The farmer can keep typing while a
 * reply is being written; only sending waits.
 */
export function ChatComposer({
  draft,
  onChangeDraft,
  typing,
  onSend,
  onStop,
  onMic,
  micDisabled,
}: {
  draft: string;
  onChangeDraft: (text: string) => void;
  typing: boolean;
  onSend: () => void;
  onStop: () => void;
  onMic: () => void;
  micDisabled: boolean;
}) {
  const canSend = !!draft.trim() && !typing;
  const actionActive = typing || canSend;

  return (
    <View className="px-3 pt-1.5">
      <View
        className="flex-row items-end gap-1.5 rounded-[28px] border border-border bg-card p-1.5"
        style={{
          shadowColor: colors.forest900,
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="কণ্ঠে কথা বলুন"
          accessibilityState={{ disabled: micDisabled }}
          disabled={micDisabled}
          onPress={onMic}
          className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
          style={{ opacity: micDisabled ? 0.45 : 1 }}
        >
          <Ionicons name="mic" size={21} color={colors.primary} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="আরণ্যকে জিজ্ঞাসা করুন…"
          placeholderTextColor={colors.muted}
          multiline
          accessibilityLabel="বার্তা লেখার ঘর"
          className="max-h-32 min-h-[44px] flex-1 px-1.5 py-2.5 font-bengali text-body text-ink"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={typing ? "উত্তর থামান" : "পাঠান"}
          accessibilityState={{ disabled: !actionActive }}
          disabled={!actionActive}
          onPress={() => (typing ? onStop() : onSend())}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: actionActive ? colors.primary : colors.neutral100 }}
        >
          <Ionicons
            name={typing ? "stop" : "arrow-up"}
            size={20}
            color={actionActive ? colors.white : colors.neutral400}
          />
        </Pressable>
      </View>
      <AppText
        variant="caption"
        className="mt-1.5 text-center text-muted"
        style={{ fontSize: 12, lineHeight: 16 }}
      >
        আরণ্য ভুল করতে পারে — ওষুধের মাত্রা কৃষি অফিসারের সাথে মিলিয়ে নিন
      </AppText>
    </View>
  );
}
