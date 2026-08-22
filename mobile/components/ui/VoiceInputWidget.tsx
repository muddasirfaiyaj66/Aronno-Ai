import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type VoiceInputWidgetProps = {
  isRecording: boolean;
  transcript: string;
  onToggleRecording: () => void;
  onChangeTranscript: (text: string) => void;
  placeholder?: string;
  listeningLabel?: string;
  editHint?: string;
  editLabel?: string;
  doneLabel?: string;
  className?: string;
  preferTyping?: boolean;
};

export function VoiceInputWidget({
  isRecording,
  transcript,
  onToggleRecording,
  onChangeTranscript,
  placeholder = "কথা বলুন বা এখানে লিখুন…",
  listeningLabel = "শুনছি… কথা বলুন",
  editHint = "জমা দেওয়ার আগে লেখা ঠিক করুন",
  editLabel = "সম্পাদনা",
  doneLabel = "ঠিক আছে",
  className = "",
  preferTyping = false,
}: VoiceInputWidgetProps) {
  const [editing, setEditing] = useState(preferTyping);

  useEffect(() => {
    if (preferTyping) setEditing(true);
  }, [preferTyping]);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: isRecording ? 900 : 1800, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [isRecording, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 0]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, isRecording ? 1.55 : 1.35]) },
    ],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.28, 0]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, isRecording ? 1.9 : 1.6]) },
    ],
  }));

  return (
    <View style={styles.card} className={className}>
      <View className="items-center gap-5">
        {preferTyping ? null : (
          <View className="h-24 w-24 items-center justify-center">
            <Animated.View
              style={[
                styles.ring,
                { borderColor: isRecording ? "#B42318" : colors.primary },
                ring2Style,
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                { borderColor: isRecording ? "#B42318" : colors.tertiary },
                ringStyle,
              ]}
            />
            <Pressable
              onPress={onToggleRecording}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? "রেকর্ডিং থামান" : "কথা বলুন"}
              className={`h-20 w-20 items-center justify-center rounded-full ${
                isRecording ? "bg-severity-high" : "bg-primary"
              }`}
              style={styles.micShadow}
            >
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={34}
                color={colors.white}
              />
            </Pressable>
          </View>
        )}

        {isRecording ? (
          <Animated.View entering={FadeIn.duration(220)}>
            <AppText
              variant="body"
              className="font-bengali-semibold text-severity-high"
            >
              {listeningLabel}
            </AppText>
          </Animated.View>
        ) : null}

        <View className="w-full rounded-2xl bg-neutral px-4 py-4">
          {editing ? (
            <TextInput
              value={transcript}
              onChangeText={onChangeTranscript}
              multiline
              autoFocus
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              accessibilityLabel={editLabel}
              className="font-bengali text-body text-ink"
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
          ) : (
            <AppText
              variant="body"
              className={`text-center leading-7 ${transcript ? "text-ink" : "text-muted"}`}
            >
              {transcript || placeholder}
            </AppText>
          )}
        </View>
      </View>

      <View className="mt-5 flex-row items-center justify-between gap-3">
        <AppText variant="caption" className="flex-1">
          {editHint}
        </AppText>
        <Pressable
          onPress={() => setEditing((prev) => !prev)}
          accessibilityRole="button"
          className="min-h-touch flex-row items-center gap-1.5 rounded-full border border-secondary-strong bg-secondary px-3.5"
        >
          <Ionicons
            name={editing ? "checkmark-circle" : "create-outline"}
            size={18}
            color={colors.primary}
          />
          <AppText
            variant="caption"
            className="font-bengali-bold text-primary"
          >
            {editing ? doneLabel : editLabel}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: "#064E3B",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  ring: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  micShadow: {
    shadowColor: "#064E3B",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
