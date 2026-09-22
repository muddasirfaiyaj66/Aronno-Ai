import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, ScreenHeader, SecondaryButton } from "@/components/ui";
import {
  clearMetrics,
  getMetrics,
  subscribeMetrics,
  type MetricEvent,
} from "@/lib/offline/metrics";
import { currentModelId, isLlmReady } from "@/lib/modelManager/llmEngine";
import { isTTSReady } from "@/lib/offlineVoice/ttsEngine";
import { isSTTReady } from "@/lib/offlineVoice/sttEngine";
import {
  isDiseaseModelAvailable,
} from "@/lib/offlineVision/diseaseModel";
import { isToolModelAvailable } from "@/lib/offlineVision/toolModel";

function formatEvent(e: MetricEvent) {
  const time = new Date(e.at).toLocaleTimeString();
  const ms = e.ms != null ? ` ${e.ms}ms` : "";
  const detail = e.detail ? ` — ${e.detail}` : "";
  return `${time}  ${e.name}${ms}${detail}`;
}

export default function OfflineDebugScreen() {
  const [events, setEvents] = useState<MetricEvent[]>(getMetrics());
  const [status, setStatus] = useState({
    llm: false,
    llmId: null as string | null,
    stt: false,
    tts: false,
    disease: false,
    tool: false,
  });

  const refreshStatus = useCallback(async () => {
    setStatus({
      llm: isLlmReady(),
      llmId: currentModelId(),
      stt: await isSTTReady(),
      tts: isTTSReady(),
      disease: await isDiseaseModelAvailable(),
      tool: await isToolModelAvailable(),
    });
  }, []);

  useEffect(() => {
    const unsub = subscribeMetrics(() => setEvents(getMetrics()));
    void refreshStatus();
    return unsub;
  }, [refreshStatus]);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="অফলাইন ডিবাগ"
        subtitle="লোকাল latency লগ — সার্ভারে যায় না"
      />
      <View className="gap-2 px-5 py-3">
        <AppText variant="caption">
          LLM: {status.llm ? `চালু (${status.llmId})` : "বন্ধ"} · STT:{" "}
          {status.stt ? "হ্যাঁ" : "না"} · TTS: {status.tts ? "sherpa" : "OS"} ·
          রোগ মডেল: {status.disease ? "আছে" : "নেই"} · হাতিয়ার:{" "}
          {status.tool ? "আছে" : "নেই"}
        </AppText>
        <View className="flex-row gap-2">
          <SecondaryButton label="রিফ্রেশ" onPress={() => void refreshStatus()} />
          <SecondaryButton
            label="লগ মুছুন"
            onPress={() => {
              clearMetrics();
              setEvents([]);
            }}
          />
        </View>
      </View>
      <FlatList
        data={events}
        keyExtractor={(e, i) => `${e.at}-${i}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListEmptyComponent={
          <AppText variant="caption" className="py-8 text-center">
            এখনো কোনো মেট্রিক নেই। অফলাইন চ্যাট বা স্ক্যান চালান।
          </AppText>
        }
        renderItem={({ item }) => (
          <Pressable className="border-b border-border py-2">
            <AppText variant="caption" className="font-mono text-ink">
              {formatEvent(item)}
            </AppText>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
