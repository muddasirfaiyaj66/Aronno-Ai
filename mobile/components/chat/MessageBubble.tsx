import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { TypingDots } from "./TypingDots";

export type ChatBubble = {
  id: string;
  role: "user" | "assistant" | "notice";
  text: string;
};

/** Small gradient leaf mark used for the assistant everywhere in chat. */
export function AssistantAvatar({ size = 32 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[colors.forest600, colors.forest900]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="leaf" size={size * 0.5} color={colors.white} />
    </LinearGradient>
  );
}

function ListenChip({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);

  const toggle = async () => {
    const tts = await import("@/lib/offlineVoice/ttsEngine");
    if (playing) {
      await tts.stopOfflineSpeech();
      setPlaying(false);
      return;
    }
    await tts.stopOfflineSpeech();
    setPlaying(true);
    try {
      await tts.speakOffline(text, {
        onDone: () => setPlaying(false),
        onStopped: () => setPlaying(false),
        onError: () => setPlaying(false),
      });
    } catch {
      setPlaying(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? "শোনা থামান" : "উত্তরটি শুনুন"}
      onPress={() => void toggle()}
      hitSlop={6}
      className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full px-3 ${
        playing ? "bg-primary" : "bg-secondary"
      }`}
    >
      <Ionicons
        name={playing ? "stop" : "volume-medium-outline"}
        size={16}
        color={playing ? colors.white : colors.primary}
      />
      <AppText
        variant="caption"
        className="font-bengali-semibold"
        style={{ color: playing ? colors.white : colors.primary }}
      >
        {playing ? "থামান" : "শুনুন"}
      </AppText>
    </Pressable>
  );
}

/** One chat row. Text is selectable (long-press → copy) for dosages and advice. */
export const MessageBubble = memo(function MessageBubble({
  item,
  waiting,
  showActions,
}: {
  item: ChatBubble;
  waiting: boolean;
  showActions: boolean;
}) {
  if (item.role === "notice") {
    return (
      <View
        className="max-w-[90%] flex-row items-center gap-2 self-center rounded-full bg-harvest-soft px-4 py-2"
        accessibilityRole="text"
      >
        <Ionicons name="information-circle" size={16} color={colors.harvest} />
        <AppText variant="caption" className="flex-shrink text-ink">
          {item.text}
        </AppText>
      </View>
    );
  }

  if (item.role === "user") {
    return (
      <View
        className="max-w-[82%] self-end rounded-3xl rounded-br-lg bg-forest-700 px-4 py-3"
        accessibilityLabel={`আপনি: ${item.text}`}
      >
        <AppText variant="body" selectable className="leading-7" style={{ color: colors.white }}>
          {item.text}
        </AppText>
      </View>
    );
  }

  return (
    <View
      className="w-full gap-2"
      accessibilityLabel={waiting ? "উত্তর লেখা হচ্ছে" : `আরণ্য: ${item.text}`}
    >
      <View className="flex-row items-center gap-2">
        <AssistantAvatar size={28} />
        <AppText variant="caption" className="font-bengali-semibold text-ink">
          আরণ্য
        </AppText>
      </View>
      <View className="ml-9 rounded-3xl rounded-tl-lg border border-border bg-card px-4 py-3">
        {waiting ? (
          <TypingDots />
        ) : (
          <AppText variant="body" selectable className="leading-7 text-ink">
            {item.text || "…"}
          </AppText>
        )}
      </View>
      {showActions && item.text.trim() ? (
        <View className="ml-9 flex-row items-center gap-2">
          <ListenChip text={item.text} />
        </View>
      ) : null}
    </View>
  );
});
