import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PrimaryButton, ScreenHeader } from "@/components/ui";
import { colors } from "@/constants/theme";
import { replyToText, startChatTurn } from "@/lib/offlineChat/chatLoop";
import {
  autoLoadLlm,
  hasInstalledLlm,
  isLlmReady,
} from "@/lib/modelManager/llmEngine";
import { isSTTReady } from "@/lib/offlineVoice/sttEngine";
import { listChatTurns } from "@/lib/offlineDb/queries";
import { userFacingError } from "@/lib/userFacingError";

type Bubble = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

export default function AssistantScreen() {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: "welcome",
      role: "system",
      text: "আমি আরণ্য — অফলাইনে বাংলায় সাহায্য করতে পারি। লিখুন বা মাইক চাপুন।",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [sttReady, setSttReady] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const refreshLlm = useCallback(async () => {
    const installed = await hasInstalledLlm();
    setHasModel(installed);
    if (installed && !isLlmReady()) {
      await autoLoadLlm();
    }
    setLlmReady(isLlmReady());
    setSttReady(await isSTTReady());
  }, []);

  useEffect(() => {
    void refreshLlm();
    void listChatTurns(60)
      .then((turns) => {
        if (!turns.length) return;
        setBubbles((prev) => {
          const welcome = prev.filter((b) => b.role === "system");
          const restored: Bubble[] = turns.map((t) => ({
            id: t.localId,
            role: t.role,
            text: t.textBn,
          }));
          return [...welcome, ...restored];
        });
      })
      .catch(() => undefined);
    return () => {
      stopRef.current?.();
    };
  }, [refreshLlm]);

  function appendBubble(role: Bubble["role"], text: string) {
    const id = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setBubbles((prev) => [...prev, { id, role, text }]);
    return id;
  }

  function updateBubble(id: string, text: string) {
    setBubbles((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text } : b)),
    );
  }

  function ensureLlmOrPrompt(): boolean {
    if (isLlmReady()) return true;
    void refreshLlm();
    appendBubble(
      "system",
      "আগে মডেল ম্যানেজার থেকে জেমা ডাউনলোড করুন, তারপর আবার চেষ্টা করুন।",
    );
    return false;
  }

  async function sendText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || generating || listening) return;
    if (!ensureLlmOrPrompt()) return;

    appendBubble("user", cleaned);
    setDraft("");
    setGenerating(true);
    const assistantId = appendBubble("assistant", "");
    assistantIdRef.current = assistantId;

    await replyToText(cleaned, {
      onTextChunk: (token) => {
        const id = assistantIdRef.current;
        if (!id) return;
        setBubbles((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, text: b.text + token } : b,
          ),
        );
      },
      onDone: () => setGenerating(false),
      onError: (err) => {
        appendBubble("system", userFacingError(err, "chat"));
        setGenerating(false);
      },
    });
  }

  function startTurn() {
    if (listening || generating) return;
    if (!ensureLlmOrPrompt()) return;

    if (!sttReady) {
      appendBubble(
        "system",
        "অফলাইন কণ্ঠ মডেল নেই — নিচে লিখে পাঠান, অথবা মডেল ম্যানেজার থেকে কণ্ঠ মডেল ডাউনলোড করুন।",
      );
      return;
    }

    setListening(true);
    let userId: string | null = null;

    stopRef.current = startChatTurn({
      onPartialTranscript: (text) => {
        if (!userId) userId = appendBubble("user", text);
        else updateBubble(userId, text);
      },
      onFinalTranscript: (text) => {
        setListening(false);
        setGenerating(true);
        if (!userId) userId = appendBubble("user", text);
        else updateBubble(userId, text);
        const assistantId = appendBubble("assistant", "");
        assistantIdRef.current = assistantId;
      },
      onTextChunk: (token) => {
        const id = assistantIdRef.current;
        if (!id) return;
        setBubbles((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, text: b.text + token } : b,
          ),
        );
      },
      onDone: () => {
        setListening(false);
        setGenerating(false);
        stopRef.current = null;
      },
      onError: (err) => {
        appendBubble("system", userFacingError(err, "chat"));
        setListening(false);
        setGenerating(false);
      },
    });
  }

  function stopTurn() {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
    setGenerating(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="অফলাইন সহকারী"
        subtitle="জেমা মডেল দিয়ে বাংলায় কথা — ইন্টারনেট ছাড়া।"
      />

      {!hasModel || !llmReady ? (
        <View className="mx-5 mt-4 rounded-2xl border border-border bg-white p-4">
          <AppText variant="bodyLg">মডেল দরকার</AppText>
          <AppText variant="caption" className="mt-2 leading-6">
            অফলাইন চ্যাটবট চালাতে জেমা ডাউনলোড করুন। ডাউনলোড শেষ হলে এটি
            নিজে থেকে চালু হবে।
          </AppText>
          <View className="mt-4">
            <PrimaryButton
              label="মডেল ম্যানেজার খুলুন"
              onPress={() => router.push("/(root)/(tabs)/models")}
            />
          </View>
        </View>
      ) : null}

      <FlatList
        className="flex-1"
        data={bubbles}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 12 }}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          const isSystem = item.role === "system";
          return (
            <View
              className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                isUser
                  ? "self-end bg-primary"
                  : isSystem
                    ? "self-center bg-harvestSoft"
                    : "self-start border border-border bg-white"
              }`}
            >
              <AppText
                variant="body"
                className={isUser ? "text-white" : "text-ink"}
              >
                {item.text || (generating && !isUser ? "…" : "")}
              </AppText>
            </View>
          );
        }}
      />

      <View className="border-t border-border bg-white px-4 pb-4 pt-3">
        <View className="mb-3 flex-row items-end gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="বাংলায় লিখুন…"
            placeholderTextColor={colors.muted}
            multiline
            className="max-h-28 flex-1 rounded-2xl bg-neutral px-4 py-3 font-bengali text-body text-ink"
            editable={!generating && !listening}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="পাঠান"
            disabled={!draft.trim() || generating || listening}
            onPress={() => void sendText(draft)}
            className="h-12 w-12 items-center justify-center rounded-full bg-primary"
            style={{ opacity: draft.trim() ? 1 : 0.45 }}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? "থামান" : "কথা বলুন"}
            onPress={() => (listening || generating ? stopTurn() : startTurn())}
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                listening || generating ? colors.harvest : colors.tertiary,
            }}
          >
            <Ionicons
              name={listening || generating ? "stop" : "mic"}
              size={22}
              color={colors.white}
            />
          </Pressable>
        </View>
        <AppText variant="caption" className="text-center">
          {listening
            ? "শুনছি…"
            : generating
              ? "উত্তর তৈরি হচ্ছে…"
              : sttReady
                ? "লিখুন অথবা মাইক চাপুন"
                : "লিখে পাঠান (STT মডেল নেই)"}
        </AppText>
      </View>
    </SafeAreaView>
  );
}
