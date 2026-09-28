import { useState } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/context/locale";
import { speakOffline, stopOfflineSpeech } from "@/lib/offlineVoice/ttsEngine";

export type ListenButtonProps = {
  textBn: string;
  label?: string;
  className?: string;
};

export function ListenButton({ textBn, label, className = "" }: ListenButtonProps) {
  const { t } = useLocale();
  const [playing, setPlaying] = useState(false);
  const playLabel = label ?? t("শুনুন বাংলায়", "Listen in Bangla");
  const pauseLabel = t("থামান", "Stop");

  const toggle = async () => {
    if (playing) {
      await stopOfflineSpeech();
      setPlaying(false);
      return;
    }
    const spoken = textBn.replace(/\s+/g, " ").trim();
    if (!spoken) return;
    setPlaying(true);
    try {
      await speakOffline(spoken, {
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
      onPress={() => {
        void toggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? pauseLabel : playLabel}
      className={`min-h-touch-lg flex-row items-center justify-center gap-2 rounded-2xl px-5 active:opacity-90 ${
        playing ? "bg-primary-800" : "bg-forest-700"
      } ${className}`}
      style={{
        shadowColor: colors.primary,
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Ionicons
        name={playing ? "stop-circle" : "volume-high"}
        size={26}
        color={colors.white}
      />
      <AppText variant="bodyLg" className="font-bengali-bold text-white">
        {playing ? pauseLabel : playLabel}
      </AppText>
    </Pressable>
  );
}
