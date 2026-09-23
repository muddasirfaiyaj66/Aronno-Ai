import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { sanitizeAssistantReply } from "@/lib/offlineChat/sanitize";
import { replyToText } from "@/lib/offlineChat/chatLoop";
import type {
  LiveConversationHandle,
  LivePhase,
} from "@/lib/offlineChat/liveConversation";
import { hasInstalledLlm, isInstalled } from "@/lib/modelManager/modelManager";
import { catalogByKind } from "@/lib/modelManager/catalog";
import {
  clearChatTurns,
  deleteChatSession,
  listChatSessions,
  listChatTurns,
} from "@/lib/offlineDb/queries";
import type { LocalChatSessionRow } from "@/lib/offlineDb/schema";
import {
  getActiveSessionId,
  startNewChatSession,
  switchChatSession,
} from "@/lib/offlineChat/sessionStore";
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
  "ধান চাষে যন্ত্রপাতি কী লাগে?",
  "টমেটোতে কোন সার দেব?",
];

const JUNK_RE =
  /<\||<start_of_turn|<end_of_turn|এখন ভালো উত্তর তৈরি করতে পারিনি/;

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
    hint: "থামলেই উত্তর দেওয়া হবে",
    tone: colors.leaf400,
  },
  thinking: {
    title: "প্রস্তুত হচ্ছে",
    hint: "একটু অপেক্ষা করুন",
    tone: colors.harvest,
  },
  speaking: {
    title: "বলছি",
    hint: "শেষ হলে আবার শোনা যাবে",
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
    <View
      accessible
      accessibilityLabel="উত্তর লেখা হচ্ছে"
      className="flex-row items-center gap-1.5 py-1"
    >
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
  const micScale = breathe;
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
      ? "hourglass-outline"
      : phase === "speaking"
        ? "volume-high"
        : "mic";

  return (
    <View
      accessible
      accessibilityLabel={
        phase === "idle" ? "মাইক্রোফোন" : PHASE_COPY[phase as Exclude<LivePhase, "idle">].title
      }
      className="h-52 w-52 items-center justify-center"
    >
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
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.forest900,
          }}
        >
          <Ionicons name={icon} size={44} color={colors.white} />
        </View>
      </Animated.View>
    </View>
  );
}

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
  const [loadHint, setLoadHint] = useState("");
  const [sttReady, setSttReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<LocalChatSessionRow[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(
    null,
  );
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

  const loadSessionBubbles = useCallback(async (sessionId: string) => {
    const turns = await listChatTurns(120, sessionId);
    setBubbles(
      turns
        .filter((t) => !JUNK_RE.test(t.textBn))
        .map((t) => ({
          id: t.localId,
          role: t.role,
          text: cleanBubbleText(t.role, t.textBn),
        })),
    );
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await listChatSessions(40).catch(() => []);
    setSessions(list);
  }, []);

  const refreshModels = useCallback(async () => {
    setLlmLoading(true);
    try {
      const installed = await hasInstalledLlm();
      setHasModel(installed);
      const { isLlmReady, ensureLlmLoaded, subscribeLlmLoad } = await import(
        "@/lib/modelManager/llmEngine"
      );
      setLlmReady(isLlmReady());
      const stt = catalogByKind("stt")[0];
      setSttReady(stt ? await isInstalled(stt) : false);

      // Warm preferred Gemma so chat can answer from the model.
      if (installed && !isLlmReady()) {
        const unsub = subscribeLlmLoad((p) => {
          if (p.messageBn) setLoadHint(p.messageBn);
          if (p.phase === "done") {
            setLlmReady(true);
            setLoadHint("");
          }
          if (p.phase === "error") {
            setLoadHint(p.messageBn ?? "মডেল লোড ব্যর্থ");
          }
        });
        try {
          setLoadHint("জেমা মডেল লোড হচ্ছে…");
          const id = await ensureLlmLoaded();
          setLlmReady(!!id);
          if (!id) {
            setLoadHint("মডেল ম্যানেজার থেকে «চালু করুন» চাপুন");
          } else {
            setLoadHint("");
          }
        } finally {
          unsub();
        }
      }
    } catch {
      setHasModel(false);
      setLlmReady(false);
      setSttReady(false);
    } finally {
      setLlmLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          if (cancelled) return;
          await refreshModels();
          if (cancelled) return;
          const sid = await getActiveSessionId();
          if (cancelled) return;
          setActiveSessionIdState(sid);
          await loadSessionBubbles(sid).catch(() => {
            if (!cancelled) setBubbles([]);
          });
          if (!cancelled) await refreshSessions();
        } catch {
          if (!cancelled) setBubbles([]);
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel?.();
      liveRef.current?.stop();
      liveRef.current = null;
      // Do not import TTS/STT on unmount — that reloads native modules.
    };
  }, [refreshModels, loadSessionBubbles, refreshSessions]);

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

  async function sendText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || busy) return;
    setDraft("");
    append("user", cleaned);
    const assistantId = append("assistant", "");
    setTyping(true);
    // First Gemma load can take 30–90s on phones.
    const unlock = setTimeout(() => setTyping(false), 120000);
    try {
      await replyToText(cleaned, {
        onStatus: (msg) => {
          if (msg) setLoadHint(msg);
          else setLoadHint("");
        },
        onTextChunk: (token) => appendToBubble(assistantId, token),
        onDone: () => {
          clearTimeout(unlock);
          setTyping(false);
          setLoadHint("");
          void refreshSessions();
          void import("@/lib/modelManager/llmEngine")
            .then((m) => setLlmReady(m.isLlmReady()))
            .catch(() => undefined);
        },
        onError: (err) => append("notice", userFacingError(err, "chat")),
      });
    } catch (err) {
      clearTimeout(unlock);
      setTyping(false);
      setLoadHint("");
      append("notice", userFacingError(err, "chat"));
    }
  }

  async function startLive() {
    if (busy) return;

    // Mic sits above the tab bar — confirm so a tab tap never boots sherpa.
    Alert.alert(
      "কণ্ঠে আলোচনা?",
      "কণ্ঠে আলোচনা শুরু করবেন? চাইলে লিখেও জিজ্ঞাসা করতে পারেন।",
      [
        { text: "লিখে চালিয়ে যান", style: "cancel" },
        {
          text: "কণ্ঠ চালু",
          onPress: () => {
            void (async () => {
              try {
                // Lazy-load voice stack only after confirm (avoids STT on tab open).
                const { startLiveConversation } = await import(
                  "@/lib/offlineChat/liveConversation"
                );
                liveRef.current = startLiveConversation({
                  greet: false,
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
                  onError: (err) =>
                    append("notice", userFacingError(err, "chat")),
                });
              } catch (err) {
                append(
                  "notice",
                  userFacingError(err, "chat") ||
                    "কণ্ঠ চালু যায়নি। লিখে জিজ্ঞাসা করুন।",
                );
                setLivePhase("idle");
              }
            })();
          },
        },
      ],
    );
  }

  function stopLive() {
    liveRef.current?.stop();
    liveRef.current = null;
    setLivePhase("idle");
  }

  async function newChat() {
    if (live) stopLive();
    const id = await startNewChatSession();
    setActiveSessionIdState(id);
    setBubbles([]);
    await refreshSessions();
  }

  async function openHistory() {
    await refreshSessions();
    setHistoryOpen(true);
  }

  async function selectSession(id: string) {
    if (live) stopLive();
    await switchChatSession(id);
    setActiveSessionIdState(id);
    await loadSessionBubbles(id);
    setHistoryOpen(false);
  }

  function confirmDeleteSession(id: string, title: string) {
    Alert.alert("আলোচনা মুছবেন?", `"${title}" স্থায়ীভাবে মুছে যাবে।`, [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await deleteChatSession(id);
            if (activeSessionId === id) {
              const next = await startNewChatSession();
              setActiveSessionIdState(next);
              setBubbles([]);
            }
            await refreshSessions();
          })();
        },
      },
    ]);
  }

  function confirmClearCurrent() {
    Alert.alert("বর্তমান আলোচনা মুছবেন?", "এই চ্যাটের সব বার্তা মুছে যাবে।", [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (activeSessionId) {
              await clearChatTurns(activeSessionId);
            }
            setBubbles([]);
            setHistoryOpen(false);
          })();
        },
      },
    ]);
  }

  const status = llmLoading
    ? { color: colors.harvest, text: "জেমা লোড হচ্ছে…", label: "লোড হচ্ছে" }
    : loadHint
      ? { color: colors.harvest, text: loadHint, label: "লোড" }
      : llmReady
        ? { color: colors.leaf400, text: "অফলাইন · জেমা চালু — মডেল উত্তর দিচ্ছে", label: "প্রস্তুত" }
        : {
            color: colors.harvest,
            text: hasModel
              ? "জেমা ফাইল আছে · মডেল ম্যানেজার থেকে «চালু করুন»"
              : "মডেল ম্যানেজার থেকে জেমা ডাউনলোড করুন",
            label: hasModel ? "চালু করুন" : "ডাউনলোড",
          };

  const lastId = bubbles[bubbles.length - 1]?.id;
  const liveCopy = live
    ? PHASE_COPY[livePhase as Exclude<LivePhase, "idle">]
    : null;
  const lastAssistant = [...bubbles]
    .reverse()
    .find((b) => b.role === "assistant" && b.text.trim());

  return (
    <View className="flex-1 bg-neutral">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header — high contrast, clear actions */}
        <View
          className="flex-row items-center gap-2 border-b border-border bg-white px-3 py-2.5"
          accessibilityRole="header"
        >
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.secondary }}
            accessible={false}
          >
            <Ionicons name="chatbubbles" size={22} color={colors.primary} />
          </View>
          <View className="min-w-0 flex-1">
            <AppText
              variant="bodyLg"
              className="font-bengali-bold text-ink"
              accessibilityRole="header"
            >
              কৃষি পরামর্শ
            </AppText>
            <AppText
              variant="caption"
              className="text-muted"
              accessibilityLabel={`অবস্থা: ${status.label}`}
            >
              {status.text}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="আগের আলোচনা"
            onPress={() => void openHistory()}
            hitSlop={8}
            className="min-h-touch min-w-[56px] items-center justify-center rounded-xl px-2 py-1"
            style={{ backgroundColor: colors.secondary }}
          >
            <Ionicons name="time-outline" size={20} color={colors.ink} />
            <AppText variant="caption" className="mt-0.5 text-ink">
              ইতিহাস
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="নতুন আলোচনা"
            onPress={() => void newChat()}
            hitSlop={8}
            className="min-h-touch min-w-[56px] items-center justify-center rounded-xl px-2 py-1"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="add" size={22} color={colors.white} />
            <AppText variant="caption" className="mt-0.5 text-white">
              নতুন
            </AppText>
          </Pressable>
        </View>

        {!llmLoading && !llmReady && !hasModel ? (
          <View
            className="mx-3 mt-3 flex-row items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3"
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={colors.primary}
            />
            <AppText variant="caption" className="flex-1 text-ink">
              জ্ঞানভাণ্ডার দিয়ে উত্তর দেওয়া হচ্ছে। পূর্ণ উত্তরের জন্য মডেল
              ম্যানেজার থেকে জেমা ডাউনলোড করুন।
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="মডেল ম্যানেজার খুলুন"
              onPress={() => router.push("/(root)/(tabs)/models")}
              className="min-h-touch items-center justify-center rounded-xl bg-primary px-3"
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
          <View className="flex-1 items-center justify-between px-6 pb-6 pt-4">
            <View className="w-full items-center pt-6">
              <AppText variant="caption" className="mb-2 text-primary">
                কণ্ঠে আলোচনা
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
                <View className="w-full rounded-2xl border border-border bg-white px-5 py-4">
                  <AppText variant="caption" className="mb-1 text-muted">
                    উত্তর
                  </AppText>
                  <AppText variant="bodyLg" numberOfLines={4}>
                    {lastAssistant.text}
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" className="text-center text-muted">
                  প্রশ্ন শোনার পর উত্তর দেওয়া হবে
                </AppText>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="কথোপকথন শেষ করুন"
                onPress={stopLive}
                className="min-h-touch w-full flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
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
            style={{ paddingBottom: keyboardLift }}
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
                gap: 12,
                flexGrow: 1,
              }}
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: true })
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              accessibilityLabel="আলোচনার বার্তা"
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center px-2 py-8">
                  <View
                    className="mb-5 h-20 w-20 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: colors.secondary }}
                  >
                    <Ionicons
                      name="leaf-outline"
                      size={36}
                      color={colors.primary}
                    />
                  </View>
                  <AppText variant="display" className="text-center text-ink">
                    {firstName ? `${greet}, ${firstName}` : greet}
                  </AppText>
                  <AppText
                    variant="body"
                    className="mt-2 text-center text-muted"
                  >
                    {user?.district?.nameBn
                      ? `${user.district.nameBn} এলাকার ফসল, রোগ ও আবহাওয়া নিয়ে জিজ্ঞাসা করুন।`
                      : "ফসলের রোগ, সার-সেচ বা আবহাওয়া নিয়ে জিজ্ঞাসা করুন।"}
                  </AppText>

                  <View className="mt-6 w-full gap-2.5">
                    <AppText variant="caption" className="text-muted">
                      দ্রুত প্রশ্ন — ট্যাপ করলে লেখায় জিজ্ঞাসা হবে
                    </AppText>
                    {SUGGESTIONS.map((s) => (
                      <Pressable
                        key={s}
                        accessibilityRole="button"
                        accessibilityLabel={`প্রশ্ন: ${s}`}
                        onPress={() => void sendText(s)}
                        className="min-h-touch justify-center rounded-2xl border border-border bg-white px-4 py-3.5"
                      >
                        <AppText variant="body" className="text-ink">
                          {s}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              }
              renderItem={({ item }) => {
                if (item.role === "notice") {
                  return (
                    <View
                      className="self-center rounded-2xl border border-border bg-harvest-soft px-4 py-2.5"
                      accessibilityRole="text"
                    >
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
                    <View
                      className="max-w-[84%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-3"
                      accessibilityLabel={`আপনি: ${item.text}`}
                    >
                      <AppText variant="body" className="text-white">
                        {item.text}
                      </AppText>
                    </View>
                  );
                }
                const waiting =
                  !item.text && (typing || live) && item.id === lastId;
                return (
                  <View
                    className="max-w-[90%] flex-row items-end gap-2.5 self-start"
                    accessibilityLabel={
                      waiting ? "উত্তর লেখা হচ্ছে" : `উত্তর: ${item.text}`
                    }
                  >
                    <View
                      className="h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: colors.secondary }}
                      importantForAccessibility="no"
                    >
                      <Ionicons
                        name="leaf"
                        size={15}
                        color={colors.primary}
                      />
                    </View>
                    <View className="flex-shrink rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3">
                      {waiting ? (
                        <TypingDots />
                      ) : (
                        <AppText variant="body" className="leading-6 text-ink">
                          {item.text || "…"}
                        </AppText>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            <View
              className="border-t border-border bg-white px-3 pt-2.5"
              style={{
                paddingBottom: Math.max(
                  keyboardLift > 0 ? 10 : insets.bottom,
                  10,
                ),
              }}
            >
              <View
                className="flex-row items-end gap-2 rounded-2xl border border-border px-2 py-1.5"
                style={{ backgroundColor: colors.neutral }}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="বাংলায় প্রশ্ন লিখুন…"
                  placeholderTextColor={colors.muted}
                  multiline
                  editable={!typing}
                  accessibilityLabel="বার্তা লেখার ঘর"
                  className="max-h-28 min-h-[44px] flex-1 px-3 py-2.5 font-bengali text-body text-ink"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    draft.trim() ? "পাঠান" : "কণ্ঠে আলোচনা (নিশ্চিতকরণ লাগবে)"
                  }
                  disabled={typing}
                  onPress={() => {
                    if (draft.trim()) void sendText(draft);
                    else void startLive();
                  }}
                  className="mb-0.5 h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: draft.trim()
                      ? colors.primary
                      : colors.secondary,
                    opacity: typing ? 0.5 : 1,
                  }}
                >
                  <Ionicons
                    name={draft.trim() ? "arrow-up" : "mic-outline"}
                    size={22}
                    color={draft.trim() ? colors.white : colors.ink}
                  />
                </Pressable>
              </View>
              {keyboardLift <= 0 ? (
                <AppText variant="caption" className="mt-2 text-center text-muted">
                  {typing
                    ? "উত্তর প্রস্তুত হচ্ছে…"
                    : "লিখে পাঠান — মাইক চাপলে আগে নিশ্চিতকরণ চাইবে"}
                </AppText>
              ) : null}
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* History sheet */}
      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryOpen(false)}
        accessibilityViewIsModal
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/40"
            accessibilityRole="button"
            accessibilityLabel="বন্ধ করুন"
            onPress={() => setHistoryOpen(false)}
          />
          <View
            className="rounded-t-3xl bg-white px-4 pt-3"
            style={{
              maxHeight: "78%",
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View className="mb-3 items-center">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>
            <View className="mb-3 flex-row items-center justify-between gap-2">
              <AppText variant="title" className="flex-1 text-ink">
                আগের আলোচনা
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="নতুন আলোচনা"
                onPress={() => {
                  setHistoryOpen(false);
                  void newChat();
                }}
                className="min-h-touch flex-row items-center gap-1 rounded-xl bg-primary px-3"
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <AppText
                  variant="caption"
                  className="font-bengali-bold text-white"
                >
                  নতুন
                </AppText>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="বর্তমান আলোচনা মুছুন"
              onPress={confirmClearCurrent}
              className="mb-3 min-h-touch flex-row items-center justify-center gap-2 rounded-xl border border-[#F5C2C0] bg-[#FEF3F2]"
            >
              <Ionicons name="trash-outline" size={18} color="#B42318" />
              <AppText
                variant="body"
                className="font-bengali-semibold text-[#B42318]"
              >
                বর্তমান আলোচনা মুছুন
              </AppText>
            </Pressable>

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {sessions.length === 0 ? (
                <AppText variant="body" className="py-8 text-center text-muted">
                  এখনো কোনো আগের আলোচনা নেই।
                </AppText>
              ) : (
                sessions.map((item) => {
                  const active = item.localId === activeSessionId;
                  return (
                    <View
                      key={item.localId}
                      className={`mb-2 flex-row items-center gap-2 rounded-2xl border px-3 py-3 ${
                        active
                          ? "border-primary bg-secondary"
                          : "border-border bg-neutral"
                      }`}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${item.titleBn}, ${formatSessionDate(item.updatedAt)}`}
                        onPress={() => void selectSession(item.localId)}
                        className="min-h-touch min-w-0 flex-1 justify-center"
                      >
                        <AppText
                          variant="body"
                          className="font-bengali-semibold text-ink"
                          numberOfLines={1}
                        >
                          {item.titleBn}
                        </AppText>
                        <AppText variant="caption" className="text-muted">
                          {formatSessionDate(item.updatedAt)}
                          {active ? " · চালু" : ""}
                        </AppText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.titleBn} মুছুন`}
                        onPress={() =>
                          confirmDeleteSession(item.localId, item.titleBn)
                        }
                        hitSlop={8}
                        className="min-h-touch min-w-[56px] items-center justify-center rounded-xl bg-[#FEF3F2] px-2"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#B42318"
                        />
                        <AppText
                          variant="caption"
                          className="mt-0.5 text-[#B42318]"
                        >
                          মুছুন
                        </AppText>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
