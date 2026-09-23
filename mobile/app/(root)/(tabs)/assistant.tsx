import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { replyToText, sanitizeAssistantReply } from "@/lib/offlineChat/chatLoop";
import {
  startLiveConversation,
  type LiveConversationHandle,
  type LivePhase,
} from "@/lib/offlineChat/liveConversation";
import {
  autoLoadLlm,
  hasInstalledLlm,
  isLlmReady,
} from "@/lib/modelManager/llmEngine";
import { isSTTReady } from "@/lib/offlineVoice/sttEngine";
import { stopOfflineSpeech } from "@/lib/offlineVoice/ttsEngine";
import { clearChatTurns, listChatTurns } from "@/lib/offlineDb/queries";
import { timeOfDayGreetingBn } from "@/lib/offlineNlu/retrieve";
import { useAppSelector } from "@/store";
import { userFacingError } from "@/lib/userFacingError";

/** Lift the composer above the soft keyboard (works with edge-to-edge Android). */
function useKeyboardLift() {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setLift(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setLift(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);
  return lift;
}

type Bubble = {
  id: string;
  role: "user" | "assistant" | "notice";
  text: string;
};

const SUGGESTIONS = [
  "আজকের আবহাওয়া কেমন?",
  "ধানের পাতা হলুদ হচ্ছে কেন?",
  "টমেটোতে কোন সার দেব?",
];

const JUNK_RE = /<\||<start_of_turn|<end_of_turn|এখন ভালো উত্তর তৈরি করতে পারিনি/;

function cleanBubbleText(role: Bubble["role"], text: string) {
  if (role !== "assistant") return text;
  return sanitizeAssistantReply(text);
}

const PHASE_COPY: Record<
  Exclude<LivePhase, "idle">,
  { title: string; hint: string; tone: string }
> = {
  listening: {
    title: "শুনছি",
    hint: "স্বাভাবিক গলায় বাংলায় বলুন",
    tone: colors.primary,
  },
  hearing: {
    title: "শুনছি…",
    hint: "থামলেই উত্তর দেব",
    tone: colors.leaf400,
  },
  thinking: {
    title: "ভাবছি",
    hint: "একটু অপেক্ষা করুন",
    tone: colors.harvest,
  },
  speaking: {
    title: "বলছি",
    hint: "শেষ হলে আবার শুনব",
    tone: colors.tertiary,
  },
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.25,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View className="flex-row items-center gap-1.5 py-1">
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            opacity: v,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: colors.primary,
          }}
        />
      ))}
    </View>
  );
}

function VoiceOrb({
  phase,
  level,
}: {
  phase: LivePhase;
  level: Animated.Value;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const active = phase !== "idle";

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      ring.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: phase === "hearing" ? 420 : 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: phase === "hearing" ? 420 : 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    ringLoop.start();
    return () => {
      loop.stop();
      ringLoop.stop();
    };
  }, [active, phase, pulse, ring]);

  const tone =
    phase === "idle"
      ? colors.primary
      : PHASE_COPY[phase as Exclude<LivePhase, "idle">].tone;

  const breathe = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, phase === "hearing" ? 1.18 : 1.08],
  });
  const micScale = Animated.multiply(
    breathe,
    level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }),
  );
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.42],
  });
  const ringScale = ring.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.55],
  });
  const ringOpacity = ring.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  const icon: keyof typeof Ionicons.glyphMap =
    phase === "thinking"
      ? "sparkles"
      : phase === "speaking"
        ? "volume-high"
        : "mic";

  return (
    <View className="h-52 w-52 items-center justify-center">
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 168,
          height: 168,
          borderRadius: 84,
          borderWidth: 2,
          borderColor: tone,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: 168,
          height: 168,
          borderRadius: 84,
          backgroundColor: tone,
          opacity: haloOpacity,
          transform: [{ scale: micScale }],
        }}
      />
      <Animated.View style={{ transform: [{ scale: micScale }] }}>
        <LinearGradient
          colors={[tone, colors.forest900]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: tone,
            shadowOpacity: 0.45,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
          }}
        >
          <Ionicons name={icon} size={44} color={colors.white} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

export default function AssistantScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<Bubble>>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [livePhase, setLivePhase] = useState<LivePhase>("idle");
  const [llmReady, setLlmReady] = useState(false);
  const [llmLoading, setLlmLoading] = useState(true);
  const [hasModel, setHasModel] = useState(false);
  const [sttReady, setSttReady] = useState(false);
  const liveRef = useRef<LiveConversationHandle | null>(null);
  const level = useRef(new Animated.Value(0)).current;
  const user = useAppSelector((s) => s.auth.user);
  const firstName = user?.displayName?.trim().split(/\s+/)[0];
  const insets = useSafeAreaInsets();
  const keyboardLift = useKeyboardLift();

  const live = livePhase !== "idle";
  const busy = typing || live;
  const greet = timeOfDayGreetingBn();

  useEffect(() => {
    if (keyboardLift <= 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [keyboardLift]);

  const refreshModels = useCallback(async () => {
    setLlmLoading(true);
    const installed = await hasInstalledLlm();
    setHasModel(installed);
    if (installed && !isLlmReady()) await autoLoadLlm();
    setLlmReady(isLlmReady());
    setLlmLoading(false);
    setSttReady(await isSTTReady());
  }, []);

  useEffect(() => {
    void refreshModels();
    void listChatTurns(60)
      .then((turns) =>
        setBubbles(
          turns
            .filter((t) => !JUNK_RE.test(t.textBn))
            .map((t) => ({
              id: t.localId,
              role: t.role,
              text: cleanBubbleText(t.role, t.textBn),
            })),
        ),
      )
      .catch(() => undefined);
    return () => {
      liveRef.current?.stop();
      liveRef.current = null;
      void stopOfflineSpeech();
    };
  }, [refreshModels]);

  function append(role: Bubble["role"], text: string) {
    const id = newId(role);
    setBubbles((prev) => [...prev, { id, role, text }]);
    return id;
  }

  function appendToBubble(id: string, token: string) {
    setBubbles((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text: b.text + token } : b)),
    );
  }

  function setBubbleText(id: string, text: string) {
    setBubbles((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, text: cleanBubbleText(b.role, text) } : b,
      ),
    );
  }

  function requireLlm(): boolean {
    if (isLlmReady()) return true;
    void refreshModels();
    append(
      "notice",
      hasModel
        ? "মডেল এখনো লোড হয়নি — কয়েক সেকেন্ড পরে আবার চেষ্টা করুন।"
        : "আগে মডেল ম্যানেজার থেকে একটি জেমা মডেল ডাউনলোড করুন।",
    );
    return false;
  }

  async function sendText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || busy || !requireLlm()) return;
    setDraft("");
    append("user", cleaned);
    const assistantId = append("assistant", "");
    setTyping(true);
    await replyToText(cleaned, {
      onTextChunk: (token) => appendToBubble(assistantId, token),
      onDone: () => setTyping(false),
      onError: (err) => append("notice", userFacingError(err, "chat")),
    });
  }

  function startLive() {
    if (busy || !requireLlm()) return;
    if (!sttReady) {
      append(
        "notice",
        "কণ্ঠ শনাক্তকরণ মডেল নেই — মডেল ম্যানেজার থেকে «বাংলা কণ্ঠ শনাক্তকরণ» ডাউনলোড করুন।",
      );
      return;
    }
    liveRef.current = startLiveConversation({
      greet: bubbles.length === 0,
      onPhase: setLivePhase,
      onLevel: (v) =>
        Animated.timing(level, {
          toValue: v,
          duration: 90,
          useNativeDriver: true,
        }).start(),
      onUserFinal: (text) => append("user", text),
      onAssistantStart: () => append("assistant", ""),
      onAssistantChunk: appendToBubble,
      onAssistantSet: setBubbleText,
      onNotice: (text) => append("notice", text),
      onError: (err) => append("notice", userFacingError(err, "chat")),
    });
  }

  function stopLive() {
    liveRef.current?.stop();
    liveRef.current = null;
    void stopOfflineSpeech();
    setLivePhase("idle");
  }

  async function newChat() {
    if (live) stopLive();
    await clearChatTurns().catch(() => undefined);
    setBubbles([]);
  }

  const status = llmLoading
    ? { color: colors.harvest, text: "প্রস্তুত হচ্ছে…" }
    : llmReady
      ? { color: colors.leaf400, text: "অফলাইন · প্রস্তুত" }
      : { color: "#B42318", text: hasModel ? "এখনো প্রস্তুত নয়" : "মডেল নেই" };

  const lastId = bubbles[bubbles.length - 1]?.id;
  const liveCopy = live
    ? PHASE_COPY[livePhase as Exclude<LivePhase, "idle">]
    : null;
  const lastAssistant = [...bubbles]
    .reverse()
    .find((b) => b.role === "assistant" && b.text.trim());

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#EAF3EE", colors.sand, "#F7FAF8"]}
        locations={[0, 0.45, 1]}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1" edges={["top"]}>
          {/* Header */}
          <View className="mx-4 mt-1 flex-row items-center gap-3 rounded-3xl bg-white/90 px-3 py-3"
            style={{
              shadowColor: colors.forest900,
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.tertiary]}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="leaf" size={22} color={colors.white} />
            </LinearGradient>
            <View className="min-w-0 flex-1">
              <AppText variant="bodyLg" className="font-bengali-bold" numberOfLines={1}>
                আরণ্য
              </AppText>
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <View
                  style={{ backgroundColor: status.color }}
                  className="h-2 w-2 rounded-full"
                />
                <AppText variant="caption" numberOfLines={1}>
                  {status.text}
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="নতুন কথোপকথন"
              onPress={() => void newChat()}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.secondary }}
            >
              <Ionicons name="create-outline" size={20} color={colors.ink} />
            </Pressable>
          </View>

          {!llmLoading && !llmReady ? (
            <View className="mx-4 mt-3 flex-row items-center gap-3 rounded-3xl bg-harvest-soft px-4 py-3">
              <Ionicons
                name="cloud-download-outline"
                size={24}
                color={colors.harvest}
              />
              <AppText variant="caption" className="flex-1 text-ink">
                {hasModel
                  ? "মডেল মেমোরিতে লোড হয়নি। «জেমা ৩ (মাঝারি)» ব্যবহার করুন।"
                  : "চ্যাট করতে «জেমা ৩ (মাঝারি)» ডাউনলোড করুন (~৬৯০ MB)।"}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(root)/(tabs)/models")}
                className="rounded-full bg-primary px-4 py-2"
              >
                <AppText
                  variant="caption"
                  className="font-bengali-bold text-white"
                >
                  মডেল
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {live ? (
            /* Immersive live voice surface */
            <View className="flex-1 items-center justify-between px-6 pb-6 pt-4">
              <View className="w-full items-center pt-6">
                <AppText
                  variant="caption"
                  className="mb-2 tracking-wide text-primary"
                >
                  লাইভ কথোপকথন
                </AppText>
                <AppText variant="display" className="text-center text-ink">
                  {liveCopy?.title}
                </AppText>
                <AppText variant="body" className="mt-2 text-center text-muted">
                  {liveCopy?.hint}
                </AppText>
              </View>

              <VoiceOrb phase={livePhase} level={level} />

              <View className="w-full items-center gap-4">
                {lastAssistant ? (
                  <View
                    className="w-full rounded-3xl bg-white/85 px-5 py-4"
                    style={{
                      shadowColor: colors.forest900,
                      shadowOpacity: 0.06,
                      shadowRadius: 10,
                      elevation: 2,
                    }}
                  >
                    <AppText variant="caption" className="mb-1 text-primary">
                      আরণ্য বলছে
                    </AppText>
                    <AppText variant="bodyLg" numberOfLines={4}>
                      {lastAssistant.text}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption" className="text-center">
                    আপনার প্রশ্ন শুনে উত্তর দেব
                  </AppText>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="কথোপকথন শেষ করুন"
                  onPress={stopLive}
                  className="min-h-touch w-full flex-row items-center justify-center gap-2 rounded-full py-3.5"
                  style={{ backgroundColor: colors.forest900 }}
                >
                  <Ionicons name="stop" size={18} color={colors.white} />
                  <AppText
                    variant="body"
                    className="font-bengali-bold text-white"
                  >
                    শেষ করুন
                  </AppText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              className="flex-1"
              style={{
                // Edge-to-edge Android often ignores adjustResize — lift chat above keyboard.
                paddingBottom: keyboardLift,
              }}
            >
              <FlatList
                ref={listRef}
                className="flex-1"
                data={bubbles}
                keyExtractor={(b) => b.id}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 12,
                  gap: 14,
                  flexGrow: 1,
                }}
                onContentSizeChange={() =>
                  listRef.current?.scrollToEnd({ animated: true })
                }
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View className="flex-1 items-center justify-center px-2 py-8">
                    <LinearGradient
                      colors={[colors.secondary, "#FFFFFF"]}
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 44,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 18,
                      }}
                    >
                      <Ionicons
                        name="chatbubbles"
                        size={36}
                        color={colors.primary}
                      />
                    </LinearGradient>
                    <AppText variant="display" className="text-center text-ink">
                      {firstName ? `${greet}, ${firstName}` : greet}
                    </AppText>
                    <AppText
                      variant="body"
                      className="mt-2 text-center text-muted"
                    >
                      {user?.district?.nameBn
                        ? `আমি আরণ্য — ${user.district.nameBn} এলাকায় আপনাকে সাহায্য করব।`
                        : "আমি আরণ্য, আপনার কৃষি সহকারী। কথা বলুন বা লিখুন।"}
                    </AppText>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="কণ্ঠে কথা শুরু"
                      disabled={!sttReady || typing}
                      onPress={startLive}
                      className="mt-7 w-full flex-row items-center justify-center gap-2 rounded-full py-4"
                      style={{
                        backgroundColor: sttReady
                          ? colors.primary
                          : colors.border,
                        opacity: typing ? 0.6 : 1,
                      }}
                    >
                      <Ionicons name="mic" size={22} color={colors.white} />
                      <AppText
                        variant="bodyLg"
                        className="font-bengali-bold text-white"
                      >
                        কথা বলুন
                      </AppText>
                    </Pressable>

                    <View className="mt-6 w-full gap-2.5">
                      {SUGGESTIONS.map((s) => (
                        <Pressable
                          key={s}
                          accessibilityRole="button"
                          onPress={() => void sendText(s)}
                          className="rounded-2xl border border-border/80 bg-white/90 px-4 py-3.5"
                        >
                          <AppText variant="body">{s}</AppText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                }
                renderItem={({ item }) => {
                  if (item.role === "notice") {
                    return (
                      <View className="self-center rounded-2xl bg-harvest-soft/90 px-4 py-2.5">
                        <AppText
                          variant="caption"
                          className="text-center text-ink"
                        >
                          {item.text}
                        </AppText>
                      </View>
                    );
                  }
                  if (item.role === "user") {
                    return (
                      <View className="max-w-[84%] self-end">
                        <LinearGradient
                          colors={[colors.primary, colors.tertiary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            borderRadius: 22,
                            borderBottomRightRadius: 8,
                            paddingHorizontal: 16,
                            paddingVertical: 11,
                          }}
                        >
                          <AppText variant="body" className="text-white">
                            {item.text}
                          </AppText>
                        </LinearGradient>
                      </View>
                    );
                  }
                  const waiting =
                    !item.text && (typing || live) && item.id === lastId;
                  return (
                    <View className="max-w-[90%] flex-row items-end gap-2.5 self-start">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.secondary }}
                      >
                        <Ionicons
                          name="leaf"
                          size={15}
                          color={colors.primary}
                        />
                      </View>
                      <View
                        className="flex-shrink rounded-3xl rounded-bl-lg bg-white px-4 py-3"
                        style={{
                          shadowColor: colors.forest900,
                          shadowOpacity: 0.05,
                          shadowRadius: 8,
                          elevation: 1,
                        }}
                      >
                        {waiting ? (
                          <TypingDots />
                        ) : (
                          <AppText variant="body" className="leading-6">
                            {item.text || "…"}
                          </AppText>
                        )}
                      </View>
                    </View>
                  );
                }}
              />

              {/* Composer — stays above keyboard via paddingBottom on parent */}
              <View
                className="border-t border-border/60 bg-white px-3 pt-2.5"
                style={{
                  paddingBottom: Math.max(
                    keyboardLift > 0 ? 10 : insets.bottom,
                    10,
                  ),
                }}
              >
                <View
                  className="flex-row items-end gap-2 rounded-3xl px-2 py-1.5"
                  style={{ backgroundColor: colors.secondary }}
                >
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="বাংলায় লিখুন…"
                    placeholderTextColor={colors.muted}
                    multiline
                    editable={!typing}
                    className="max-h-28 flex-1 px-3 py-2.5 font-bengali text-body text-ink"
                  />
                  {draft.trim() ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="পাঠান"
                      disabled={typing}
                      onPress={() => void sendText(draft)}
                      className="mb-0.5 h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: colors.primary,
                        opacity: typing ? 0.5 : 1,
                      }}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={22}
                        color={colors.white}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="কণ্ঠে কথোপকথন শুরু"
                      disabled={typing}
                      onPress={startLive}
                      className="mb-0.5 h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: sttReady
                          ? colors.primary
                          : colors.border,
                        opacity: typing ? 0.5 : 1,
                      }}
                    >
                      <Ionicons name="mic" size={22} color={colors.white} />
                    </Pressable>
                  )}
                </View>
                {keyboardLift <= 0 ? (
                  <AppText variant="caption" className="mt-2 text-center">
                    {typing
                      ? "উত্তর তৈরি হচ্ছে…"
                      : sttReady
                        ? "মাইক চাপুন — একটানা কথা বলা যাবে"
                        : "কণ্ঠের জন্য «বাংলা কণ্ঠ শনাক্তকরণ» মডেল লাগবে"}
                  </AppText>
                ) : null}
              </View>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
