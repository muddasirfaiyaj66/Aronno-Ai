import { useState } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";
import { useLocale } from "@/context/locale";

export type ListenButtonProps = {
  onPlay: () => void;
  onPause?: () => void;
  label?: string;
  className?: string;
};

export function ListenButton({
  onPlay,
  onPause,
  label,
  className = "",
}: ListenButtonProps) {
  const { t } = useLocale();
  const [playing, setPlaying] = useState(false);
  const playLabel = label ?? t("শুনুন বাংলায়", "Listen in Bangla");
  const pauseLabel = t("থামান", "Stop");

  const toggle = () => {
    if (playing) {
      onPause?.();
      setPlaying(false);
      return;
    }
    onPlay();
    setPlaying(true);
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={playing ? pauseLabel : playLabel}
      className={`min-h-touch-lg flex-row items-center justify-center gap-2 rounded-2xl px-5 active:opacity-90 ${
        playing ? "bg-forest-800" : "bg-primary"
      } ${className}`}
      style={{
        shadowColor: colors.primary,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
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
