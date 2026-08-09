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
  const playLabel = label ?? t("শুনুন", "Listen");
  const pauseLabel = t("বিরতি", "Pause");

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
      className={`min-h-touch flex-row items-center justify-center gap-2 rounded-2xl bg-white px-4 active:bg-secondary-soft ${className}`}
    >
      <Ionicons
        name={playing ? "pause-circle" : "play-circle"}
        size={24}
        color={colors.primary}
      />
      <AppText variant="body" className="font-bengali-semibold text-primary">
        {playing ? pauseLabel : playLabel}
      </AppText>
    </Pressable>
  );
}
