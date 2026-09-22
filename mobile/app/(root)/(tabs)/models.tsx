import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, ScreenHeader, SecondaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  MODEL_CATALOG,
  type ModelCatalogEntry,
} from "@/lib/modelManager/catalog";
import {
  deleteModel,
  downloadModel,
  isInstalled,
  storageUsedMb,
} from "@/lib/modelManager/modelManager";
import { autoLoadLlm, unloadLlm, currentModelId } from "@/lib/modelManager/llmEngine";
import { initSTT } from "@/lib/offlineVoice/sttEngine";
import { initTTS } from "@/lib/offlineVoice/ttsEngine";
import {
  pickAndInstallVision,
  visionInstallStatus,
} from "@/lib/offlineVision/importModel";

export default function ModelsScreen() {
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [usedMb, setUsedMb] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [vision, setVision] = useState({
    disease: false,
    tool: false,
    classNames: false,
  });

  const refresh = useCallback(async () => {
    const flags: Record<string, boolean> = {};
    for (const entry of MODEL_CATALOG) {
      flags[entry.id] = await isInstalled(entry);
    }
    setInstalledMap(flags);
    setUsedMb(await storageUsedMb());
    setActiveId(currentModelId());
    setVision(await visionInstallStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDownload(entry: ModelCatalogEntry) {
    setError(null);
    setHint(null);
    setBusyId(entry.id);
    setProgress((p) => ({ ...p, [entry.id]: 0 }));
    try {
      await downloadModel(entry, (fraction) =>
        setProgress((p) => ({ ...p, [entry.id]: fraction })),
      );
      await refresh();
      if (entry.kind === "llm") {
        const loaded = await autoLoadLlm(entry.id);
        setActiveId(loaded);
        setHint("জেমা লোড হয়েছে — সহকারী ট্যাবে কথা বলুন।");
      } else if (entry.kind === "stt") {
        await initSTT();
        setHint("বাংলা STT প্রস্তুত।");
      } else if (entry.kind === "tts") {
        await initTTS();
        setHint("বাংলা TTS প্রস্তুত।");
      }
    } catch {
      setError("ডাউনলোড ব্যর্থ হয়েছে। ওয়াই‑ফাই চেক করে আবার চেষ্টা করুন।");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(entry: ModelCatalogEntry) {
    setError(null);
    setBusyId(entry.id);
    try {
      if (entry.kind === "llm" && currentModelId() === entry.id) {
        await unloadLlm();
      }
      await deleteModel(entry);
      await refresh();
    } catch {
      setError("মুছে ফেলা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusyId(null);
    }
  }

  async function importVision(kind: "disease" | "tool" | "classNames") {
    setError(null);
    const result = await pickAndInstallVision(kind);
    if (result.ok) {
      setHint(result.messageBn);
      await refresh();
    } else {
      setError(result.messageBn);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="অফলাইন এআই মডেল"
        subtitle="ডাউনলোড করুন, ব্যবহার করুন, প্রয়োজনে মুছুন — ইন্টারনেট ছাড়াই চলবে।"
      />
      <View className="px-5 py-3">
        <AppText variant="caption">
          ব্যবহৃত স্টোরেজ (আনুমানিক): {usedMb} MB
          {activeId ? ` · চালু: ${activeId}` : ""}
        </AppText>
        {hint ? (
          <AppText variant="caption" className="mt-2 text-primary">
            {hint}
          </AppText>
        ) : null}
        {error ? (
          <AppText variant="caption" className="mt-2 text-harvest">
            {error}
          </AppText>
        ) : null}
      </View>
      <FlatList
        data={MODEL_CATALOG}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListFooterComponent={
          <View className="mt-6 gap-3 border-t border-border pt-4">
            <AppText variant="bodyLg">ভিশন মডেল (ট্রেন করে ইমপোর্ট)</AppText>
            <AppText variant="caption" className="leading-6">
              Colab/`ml/` থেকে `.tflite` তৈরি করে এখানে বেছে নিন। রোগ:{" "}
              {vision.disease ? "আছে" : "নেই"} · হাতিয়ার:{" "}
              {vision.tool ? "আছে" : "নেই"} · class_names:{" "}
              {vision.classNames ? "আছে" : "নেই"}
            </AppText>
            <SecondaryButton
              label="রোগ মডেল ইমপোর্ট (.tflite)"
              onPress={() => void importVision("disease")}
            />
            <SecondaryButton
              label="হাতিয়ার মডেল ইমপোর্ট (.tflite)"
              onPress={() => void importVision("tool")}
            />
            <SecondaryButton
              label="class_names.json ইমপোর্ট"
              onPress={() => void importVision("classNames")}
            />
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        renderItem={({ item }) => {
          const installed = installedMap[item.id];
          const pct = progress[item.id];
          const busy = busyId === item.id;
          return (
            <View className="flex-row items-center gap-3 py-4">
              <View className="flex-1">
                <AppText variant="bodyLg">{item.nameBn}</AppText>
                <AppText variant="caption" className="mt-1">
                  {item.nameEn} · {item.sizeMb} MB · RAM {item.minRamMb}+ MB
                  {item.recommended ? " · সুপারিশকৃত" : ""}
                </AppText>
                {pct !== undefined && pct < 1 ? (
                  <AppText variant="caption" className="mt-1 text-forest600">
                    ডাউনলোড হচ্ছে… {Math.round(pct * 100)}%
                  </AppText>
                ) : null}
                {installed && item.kind === "llm" && activeId === item.id ? (
                  <AppText variant="caption" className="mt-1 text-primary">
                    এখন চালু আছে
                  </AppText>
                ) : null}
              </View>
              {busy ? (
                <ActivityIndicator color={colors.primary} />
              ) : installed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="মুছুন"
                  onPress={() => void handleDelete(item)}
                  className="rounded-xl bg-harvestSoft px-3 py-2"
                >
                  <AppText variant="caption" className="text-harvest">
                    মুছুন
                  </AppText>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ডাউনলোড"
                  onPress={() => void handleDownload(item)}
                  className="rounded-xl bg-primary px-3 py-2"
                >
                  <AppText variant="caption" className="text-white">
                    ডাউনলোড
                  </AppText>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
