import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, PrimaryButton, ScreenHeader } from "@/components/ui";
import { colors } from "@/constants/theme";
import { startChatTurn } from "@/lib/offlineChat/chatLoop";
import {
  autoLoadLlm,
  hasInstalledLlm,
  isLlmReady,
} from "@/lib/modelManager/llmEngine";

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
      text: "আমি আরণ্য — অফলাইনে বাংলায় কথা বলতে পারি। মাইক চাপুন।",
    },
  ]);
  const [listening, setListening] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const refreshLlm = useCallback(async () => {
    const installed = await hasInstalledLlm();
    setHasModel(installed);
    if (installed && !isLlmReady()) {
      await autoLoadLlm();
    }
    setLlmReady(isLlmReady());
  }, []);

  useEffect(() => {
    void refreshLlm();
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

  function startTurn() {
    if (listening || generating) return;
    if (!isLlmReady()) {
      void refreshLlm();
      appendBubble(
        "system",
        "আগে মডেল ম্যানেজার থেকে জেমা ডাউনলোড করুন, তারপর আবার চেষ্টা করুন।",
      );
      return;
    }

    setListening(true);
    let userId: string | null = null;
    let assistantId: string | null = null;
    assistantIdRef.current = null;

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
        assistantId = appendBubble("assistant", "");
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
      onError: () => {
        appendBubble(
          "system",
          "উত্তর তৈরি করা যায়নি। মডেল চালু আছে কিনা দেখুন।",
        );
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
        <View className="mx-5 mt-4 rounded-2xl bg-white p-4 border border-border">
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
        contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 12 }}
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
                    : "self-start bg-white border border-border"
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

      <View className="absolute bottom-6 left-0 right-0 items-center px-5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? "থামান" : "কথা বলুন"}
          onPress={() => (listening || generating ? stopTurn() : startTurn())}
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{
            backgroundColor:
              listening || generating ? colors.harvest : colors.primary,
            elevation: 6,
          }}
        >
          <Ionicons
            name={listening || generating ? "stop" : "mic"}
            size={28}
            color={colors.white}
          />
        </Pressable>
        <AppText variant="caption" className="mt-2">
          {listening
            ? "শুনছি…"
            : generating
              ? "উত্তর তৈরি হচ্ছে…"
              : "মাইক চাপুন"}
        </AppText>
      </View>
    </SafeAreaView>
  );
}
