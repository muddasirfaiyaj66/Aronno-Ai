import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { AssistantAvatar } from "./MessageBubble";

type Suggestion = {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "harvest" | "danger";
};

const SUGGESTIONS: Suggestion[] = [
  { text: "আজকের আবহাওয়া কেমন?", icon: "partly-sunny-outline", tone: "primary" },
  { text: "ধানের পাতায় দাগ হলে কী করব?", icon: "bug-outline", tone: "danger" },
  { text: "টমেটোতে কোন সার দেব?", icon: "flask-outline", tone: "harvest" },
  { text: "আজ ধানের বাজারদর কত?", icon: "pricetag-outline", tone: "primary" },
];

function toneColors(tone: Suggestion["tone"]) {
  if (tone === "harvest") return { bg: colors.harvestSoft, fg: colors.harvest };
  if (tone === "danger") return { bg: colors.dangerSoft, fg: colors.danger };
  return { bg: colors.secondary, fg: colors.primary };
}

export function ChatEmptyState({
  greeting,
  onPick,
}: {
  greeting: string;
  onPick: (text: string) => void;
}) {
  return (
    <View className="flex-1 justify-center px-1 py-6">
      <View className="items-center">
        <AssistantAvatar size={64} />
        <AppText variant="title" className="mt-4 text-center text-ink">
          {greeting}
        </AppText>
        <AppText variant="body" className="mt-1.5 text-center text-muted">
          ফসল, রোগ, সার, আবহাওয়া বা বাজারদর — লিখে বা বলে জিজ্ঞাসা করুন
        </AppText>
      </View>

      <View className="mt-8 flex-row flex-wrap justify-between gap-y-3">
        {SUGGESTIONS.map((s) => {
          const tone = toneColors(s.tone);
          return (
            <Pressable
              key={s.text}
              accessibilityRole="button"
              accessibilityLabel={`প্রশ্ন: ${s.text}`}
              onPress={() => onPick(s.text)}
              className="min-h-[112px] w-[48.5%] justify-between rounded-3xl border border-border bg-card p-4 active:opacity-80"
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: tone.bg }}
              >
                <Ionicons name={s.icon} size={20} color={tone.fg} />
              </View>
              <AppText
                variant="caption"
                className="mt-3 font-bengali-semibold text-ink"
                numberOfLines={3}
              >
                {s.text}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
