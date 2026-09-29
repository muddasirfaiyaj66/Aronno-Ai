import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import {
  AssistantAvatar,
  ChatComposer,
  ChatEmptyState,
  HistorySheet,
  MessageBubble,
  PHASE_COPY,
  VoiceOrb,
  type ChatBubble,
} from "@/components/chat";
import { colors } from "@/constants/theme";
import { sanitizeAssistantReply } from "@/lib/offlineChat/sanitize";
import { ChatUnavailableError, replyToText } from "@/lib/offlineChat/chatLoop";
import type {
  LiveConversationHandle,
  LivePhase,
} from "@/lib/offlineChat/liveConversation";
import { hasInstalledLlm } from "@/lib/modelManager/modelManager";
import {
  clearChatTurns,
  deleteChatSession,
  listChatSessions,
  listChatTurns,
} from "@/lib/offlineDb/queries";
import { requestSyncSoon } from "@/lib/offlineDb/syncEngine";
import type { LocalChatSessionRow } from "@/lib/offlineDb/schema";
import {
  getActiveSessionId,
  startNewChatSession,
  switchChatSession,
} from "@/lib/offlineChat/sessionStore";
import { timeOfDayGreetingBn } from "@/lib/offlineNlu/retrieve";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useAppSelector } from "@/store";
import { userFacingError } from "@/lib/userFacingError";

/**
 * Lift the composer above the soft keyboard (edge-to-edge Android ignores
 * adjustResize). The tab bar hides while typing, so the full height is right.
 */
function useKeyboardLift() {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) => setLift(e.endCoordinates.height));
    const onHide = Keyboard.addListener(hideEvent, () => setLift(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);
  return lift;
}

type Bubble = ChatBubble;

const JUNK_RE = /<\||<start_of_turn|<end_of_turn|এখন ভালো উত্তর তৈরি করতে পারিনি/;

/** Within this many px of the end counts as "reading the latest". */
const NEAR_BOTTOM_PX = 120;

function cleanBubbleText(role: Bubble["role"], text: string) {
  if (role !== "assistant") return text;
  return sanitizeAssistantReply(text, { allowGreeting: true });
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [liveNotice, setLiveNotice] = useState("");
  const [sessions, setSessions] = useState<LocalChatSessionRow[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const nearBottomRef = useRef(true);
  const liveRef = useRef<LiveConversationHandle | null>(null);
  const voiceCancelRef = useRef<(() => void) | null>(null);
  /** Bumped on new chat / switch / delete so in-flight replies cannot paint the wrong screen. */
  const chatGenRef = useRef(0);
  const level = useRef(new Animated.Value(0)).current;
  const user = useAppSelector((s) => s.auth.user);
  const firstName = user?.displayName?.trim().split(/\s+/)[0];
  const keyboardLift = useKeyboardLift();
  const online = useIsOnline();

  const live = livePhase !== "idle";
  const greet = timeOfDayGreetingBn();

  const scrollToEnd = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
    nearBottomRef.current = true;
    setShowJump(false);
  }, []);

  useEffect(() => {
    if (keyboardLift <= 0) return;
    const t = setTimeout(() => scrollToEnd(), 50);
    return () => clearTimeout(t);
  }, [keyboardLift, scrollToEnd]);

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
    nearBottomRef.current = true;
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await listChatSessions(40).catch(() => []);
    setSessions(list);
  }, []);

  const refreshModels = useCallback(async () => {
    setLlmLoading(true);
    try {
      setHasModel(await hasInstalledLlm());
      const { isLlmReady } = await import("@/lib/modelManager/llmEngine");
      setLlmReady(isLlmReady());
      // Do not load Gemma here. Tabs stay mounted, so a background load
      // keeps the chatbot running after the farmer leaves this screen.
    } catch {
      setHasModel(false);
      setLlmReady(false);
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
          // Pre-fetch orders/wallet/plan so the first answer about them is instant.
          void import("@/lib/offlineChat/appRag")
            .then((m) => m.warmAppFacts())
            .catch(() => undefined);
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

  useFocusEffect(
    useCallback(() => {
      return () => {
        chatGenRef.current += 1;
        voiceCancelRef.current?.();
        voiceCancelRef.current = null;
        liveRef.current?.stop();
        liveRef.current = null;
        setLivePhase("idle");
        setLiveNotice("");
        setTyping(false);
        setLoadHint("");
        void import("@/lib/offlineVoice/ttsEngine")
          .then((m) => m.stopOfflineSpeech())
          .catch(() => undefined);
      };
    }, []),
  );

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
      prev.map((b) => (b.id === id ? { ...b, text: cleanBubbleText(b.role, text) } : b)),
    );
  }

  function abortInFlightUi() {
    chatGenRef.current += 1;
    liveRef.current?.stop();
    liveRef.current = null;
    voiceCancelRef.current?.();
    voiceCancelRef.current = null;
    setLivePhase("idle");
    setLiveNotice("");
    setTyping(false);
    setLoadHint("");
    // A stopped reply leaves an empty bubble behind — drop it.
    setBubbles((prev) => prev.filter((b) => b.role !== "assistant" || b.text.trim()));
  }

  async function sendText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || typing) return;
    setDraft("");
    const gen = chatGenRef.current;
    const stillThisChat = () => chatGenRef.current === gen;
    append("user", cleaned);
    const assistantId = append("assistant", "");
    setTyping(true);
    // Sending always brings the conversation to the latest message.
    setTimeout(() => scrollToEnd(), 30);
    try {
      await replyToText(cleaned, {
        shouldContinue: stillThisChat,
        onStatus: (msg) => {
          if (stillThisChat()) setLoadHint(msg || "");
        },
        onTextChunk: (token) => {
          if (stillThisChat()) appendToBubble(assistantId, token);
        },
        // Streaming: repaint the bubble at most ~16×/s while Gemma writes.
        onTextSet: (text) => {
          if (stillThisChat()) streamToBubble(assistantId, text);
        },
        onDone: () => {
          flushStream();
          if (!stillThisChat()) return;
          setTyping(false);
          setLoadHint("");
          setBubbles((prev) =>
            prev.filter((b) => b.id !== assistantId || b.text.trim().length > 0),
          );
          void refreshSessions();
          void import("@/lib/modelManager/llmEngine")
            .then((m) => setLlmReady(m.isLlmReady()))
            .catch(() => undefined);
        },
        onError: (err) => {
          if (stillThisChat()) showChatError(assistantId, err);
        },
      });
    } catch (err) {
      if (!stillThisChat()) return;
      setTyping(false);
      setLoadHint("");
      showChatError(assistantId, err);
    }
  }

  /** A failure is a notice, never dressed up as an Aronno reply. */
  function showChatError(assistantId: string, err: unknown) {
    const message =
      err instanceof ChatUnavailableError ? err.message : userFacingError(err, "chat");
    setBubbles((prev) => [
      ...prev.filter((b) => b.id !== assistantId),
      { id: newId("notice"), role: "notice", text: message },
    ]);
  }

  const streamRef = useRef<{ id: string; text: string } | null>(null);
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flushStream() {
    if (streamTimer.current) clearTimeout(streamTimer.current);
    streamTimer.current = null;
    const pending = streamRef.current;
    streamRef.current = null;
    if (pending) setBubbleText(pending.id, pending.text);
  }

  function streamToBubble(id: string, text: string) {
    streamRef.current = { id, text };
    if (!streamTimer.current) streamTimer.current = setTimeout(flushStream, 60);
  }

  function stopLive() {
    voiceCancelRef.current?.();
    voiceCancelRef.current = null;
    liveRef.current?.stop();
    liveRef.current = null;
    setLivePhase("idle");
    setLiveNotice("");
    setLoadHint("");
  }

  async function toggleVoiceInput() {
    if (live) {
      stopLive();
      return;
    }
    if (typing) return;
    Keyboard.dismiss();
    setLiveNotice("");
    setLivePhase("thinking");
    setLoadHint("কণ্ঠ প্রস্তুত হচ্ছে…");
    try {
      const { startLiveConversation } = await import("@/lib/offlineChat/liveConversation");
      liveRef.current = startLiveConversation({
        greet: false,
        onPhase: (phase) => {
          setLivePhase(phase);
          if (phase === "idle") {
            setLoadHint("");
            setBubbles((prev) =>
              prev.filter((b) => b.role !== "assistant" || b.text.trim().length > 0),
            );
          }
        },
        onLevel: (v) =>
          Animated.timing(level, { toValue: v, duration: 90, useNativeDriver: true }).start(),
        onUserFinal: (text) => append("user", text),
        onAssistantStart: () => append("assistant", ""),
        onAssistantChunk: appendToBubble,
        onAssistantSet: setBubbleText,
        onStatus: (msg) => setLoadHint(msg),
        onNotice: (text) => {
          setLiveNotice(text);
          append("notice", text);
        },
        onError: (err) => {
          const message = userFacingError(err, "chat");
          setLiveNotice(message);
          append("notice", message);
        },
      });
    } catch (err) {
      stopLive();
      append("notice", userFacingError(err, "chat") || "কণ্ঠ চালু যায়নি।");
    }
  }

  async function newChat() {
    abortInFlightUi();
    const id = await startNewChatSession();
    setActiveSessionIdState(id);
    setBubbles([]);
    await refreshSessions();
  }

  async function selectSession(id: string) {
    abortInFlightUi();
    await switchChatSession(id);
    setActiveSessionIdState(id);
    await loadSessionBubbles(id);
    setHistoryOpen(false);
    setTimeout(() => scrollToEnd(false), 60);
  }

  function confirmDeleteSession(id: string, title: string) {
    Alert.alert("আলোচনা মুছবেন?", `"${title}" এই ফোন ও আপনার অ্যাকাউন্ট থেকে মুছে যাবে।`, [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void (async () => {
            abortInFlightUi();
            await deleteChatSession(id);
            if (activeSessionId === id) {
              const next = await startNewChatSession();
              setActiveSessionIdState(next);
              setBubbles([]);
            }
            await refreshSessions();
            requestSyncSoon();
          })();
        },
      },
    ]);
  }

  function confirmClearCurrent() {
    Alert.alert("বার্তাগুলো মুছবেন?", "এই আলোচনার সব বার্তা মুছে যাবে।", [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void (async () => {
            abortInFlightUi();
            if (activeSessionId) await clearChatTurns(activeSessionId);
            setBubbles([]);
            setHistoryOpen(false);
            requestSyncSoon();
          })();
        },
      },
    ]);
  }

  function onListScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const near = distance < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setShowJump((prev) => (prev === !near ? prev : !near));
  }

  const lastId = bubbles[bubbles.length - 1]?.id;
  const liveCopy = live ? PHASE_COPY[livePhase as Exclude<LivePhase, "idle">] : null;
  const lastUser = [...bubbles].reverse().find((b) => b.role === "user" && b.text.trim());
  const lastAssistant = [...bubbles]
    .reverse()
    .find((b) => b.role === "assistant" && b.text.trim());

  const status = loadHint
    ? { text: loadHint, dot: colors.harvest }
    : online
      ? { text: "অনলাইন · সব প্রশ্নের উত্তর", dot: colors.tertiary }
      : llmReady || hasModel
        ? { text: "অফলাইন AI চালু", dot: colors.tertiary }
        : { text: "অফলাইন · জ্ঞানভাণ্ডার থেকে উত্তর", dot: colors.harvest };

  return (
    <View className="flex-1 bg-neutral">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 pb-3 pt-2" accessibilityRole="header">
          <AssistantAvatar size={44} />
          <View className="min-w-0 flex-1">
            <AppText variant="subtitle" className="text-ink">
              আরণ্য সহকারী
            </AppText>
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: status.dot }} />
              <AppText variant="caption" className="flex-1 text-muted" numberOfLines={1}>
                {status.text}
              </AppText>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="আলোচনার ইতিহাস"
            onPress={() => {
              void refreshSessions();
              setHistoryOpen(true);
            }}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
          >
            <Ionicons name="time-outline" size={21} color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="নতুন আলোচনা"
            onPress={() => void newChat()}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary"
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </Pressable>
        </View>

        {!online && !llmLoading && !llmReady && !hasModel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="অফলাইন মডেল ডাউনলোড করুন"
            onPress={() => router.push("/(root)/(tabs)/models")}
            className="mx-4 mb-2 flex-row items-center gap-3 rounded-2xl bg-harvest-soft px-4 py-3"
          >
            <Ionicons name="cloud-download-outline" size={22} color={colors.harvest} />
            <AppText variant="caption" className="flex-1 text-ink">
              ইন্টারনেট ছাড়াও পূর্ণ উত্তর পেতে অফলাইন মডেল ডাউনলোড করুন
            </AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.harvest} />
          </Pressable>
        ) : null}

        {live ? (
          <View className="flex-1 items-center justify-between px-6 pb-6 pt-2">
            <View className="w-full items-center pt-4">
              <View className="mb-3 rounded-full bg-secondary px-3 py-1">
                <AppText variant="caption" className="font-bengali-semibold text-primary">
                  কণ্ঠে আলোচনা
                </AppText>
              </View>
              <AppText variant="display" className="text-center text-ink">
                {liveCopy?.title}
              </AppText>
              <AppText variant="body" className="mt-2 text-center text-muted">
                {loadHint || liveCopy?.hint}
              </AppText>
            </View>

            <VoiceOrb phase={livePhase} level={level} />

            <View className="w-full items-center gap-3">
              {lastUser ? (
                <View className="w-full rounded-3xl bg-forest-700 px-4 py-3">
                  <AppText variant="caption" className="mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                    আপনি
                  </AppText>
                  <AppText variant="body" numberOfLines={2} style={{ color: colors.white }}>
                    {lastUser.text}
                  </AppText>
                </View>
              ) : null}
              {lastAssistant ? (
                <View className="w-full rounded-3xl border border-border bg-card px-5 py-4">
                  <AppText variant="caption" className="mb-1 text-muted">
                    আরণ্য
                  </AppText>
                  <AppText variant="bodyLg" numberOfLines={4}>
                    {lastAssistant.text}
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" className="text-center text-muted">
                  {liveNotice || "কথা বলুন — শোনা শেষ হলে উত্তর এখানে দেখাবে"}
                </AppText>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="কথোপকথন শেষ করুন"
                onPress={stopLive}
                className="min-h-touch w-full flex-row items-center justify-center gap-2 rounded-full bg-danger py-3.5"
              >
                <Ionicons name="close" size={20} color={colors.white} />
                <AppText variant="body" className="font-bengali-bold" style={{ color: colors.white }}>
                  শেষ করুন
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-1" style={{ paddingBottom: keyboardLift > 0 ? keyboardLift : 8 }}>
            <FlatList
              ref={listRef}
              className="flex-1"
              data={bubbles}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 16,
                gap: 16,
                flexGrow: 1,
              }}
              onScroll={onListScroll}
              scrollEventThrottle={64}
              // Follow new text only while the farmer is at the bottom.
              onContentSizeChange={() => {
                if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              accessibilityLabel="আলোচনার বার্তা"
              ListEmptyComponent={
                <ChatEmptyState
                  greeting={firstName ? `${greet}, ${firstName}` : greet}
                  onPick={(s) => void sendText(s)}
                />
              }
              renderItem={({ item }) => (
                <MessageBubble
                  item={item}
                  waiting={!item.text && typing && item.id === lastId}
                  showActions={!(typing && item.id === lastId)}
                />
              )}
            />

            {showJump && bubbles.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="সর্বশেষ বার্তায় যান"
                onPress={() => scrollToEnd()}
                className="absolute right-4 h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
                style={{
                  bottom: (keyboardLift > 0 ? keyboardLift : 8) + 96,
                  elevation: 4,
                  shadowColor: colors.forest900,
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                }}
              >
                <Ionicons name="arrow-down" size={20} color={colors.primary} />
              </Pressable>
            ) : null}

            <ChatComposer
              draft={draft}
              onChangeDraft={setDraft}
              typing={typing}
              onSend={() => void sendText(draft)}
              onStop={abortInFlightUi}
              onMic={() => void toggleVoiceInput()}
              micDisabled={typing}
            />
          </View>
        )}
      </SafeAreaView>

      <HistorySheet
        visible={historyOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onClose={() => setHistoryOpen(false)}
        onSelect={(id) => void selectSession(id)}
        onDelete={confirmDeleteSession}
        onNew={() => {
          setHistoryOpen(false);
          void newChat();
        }}
        onClearCurrent={confirmClearCurrent}
      />
    </View>
  );
}
