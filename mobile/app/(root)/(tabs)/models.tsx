import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  currentModelId,
  selectLlm,
  unloadLlm,
} from "@/lib/modelManager/llmEngine";
import {
  clearPreferredLlmId,
  getPreferredLlmId,
} from "@/lib/modelManager/preferredLlm";
import { initSTT } from "@/lib/offlineVoice/sttEngine";
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
  const [preferredId, setPreferredId] = useState<string | null>(null);
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
    setPreferredId(await getPreferredLlmId());
    setVision(await visionInstallStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installedLlms = useMemo(
    () => MODEL_CATALOG.filter((e) => e.kind === "llm" && installedMap[e.id]),
    [installedMap],
  );

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
        const loaded = await selectLlm(entry.id);
        setActiveId(loaded);
        setPreferredId(entry.id);
        setHint(
          loaded
            ? `${entry.nameBn} চালু হয়েছে — সহকারী ট্যাবে কথা বলুন।`
            : "ফাইল আছে, কিন্তু মেমোরিতে লোড হয়নি। ডিভাইসের RAM কম হতে পারে — ছোট জেমা (২৭০এম) বেছে নিন।",
        );
      } else if (entry.kind === "stt") {
        const ok = await initSTT();
        setHint(ok ? "বাংলা STT প্রস্তুত।" : "STT ফাইল আছে, কিন্তু লোড ব্যর্থ।");
      } else if (entry.kind === "tts") {
        setHint("কণ্ঠ উচ্চারণ ডিভাইস TTS (expo-speech) দিয়ে চলবে।");
      }
    } catch {
      setError("ডাউনলোড ব্যর্থ হয়েছে। ওয়াই‑ফাই চেক করে আবার চেষ্টা করুন।");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSelect(entry: ModelCatalogEntry) {
    setError(null);
    setHint(null);
    setBusyId(entry.id);
    try {
      const loaded = await selectLlm(entry.id);
      setActiveId(loaded);
      setPreferredId(entry.id);
      setHint(
        loaded
          ? `${entry.nameBn} এখন চালু — সহকারীতে ব্যবহার করুন।`
          : "লোড ব্যর্থ। RAM কম হলে ছোট মডেল বেছে নিন।",
      );
    } catch {
      setError("মডেল লোড যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusyId(null);
      await refresh();
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
      if (preferredId === entry.id) {
        await clearPreferredLlmId();
        const next = MODEL_CATALOG.find(
          (e) => e.kind === "llm" && e.id !== entry.id && installedMap[e.id],
        );
        if (next) {
          await selectLlm(next.id);
        }
      }
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

  const activeName =
    MODEL_CATALOG.find((e) => e.id === (activeId ?? preferredId))?.nameBn ??
    null;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="অফলাইন এআই মডেল"
        subtitle="ডাউনলোড করুন, যে জেমা চান সেটা বেছে নিন, প্রয়োজনে মুছুন।"
      />
      <View className="px-5 py-3">
        <AppText variant="caption">
          ব্যবহৃত স্টোরেজ (আনুমানিক): {usedMb} MB
          {activeName ? ` · চালু: ${activeName}` : ""}
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

      {installedLlms.length > 0 ? (
        <View className="mx-5 mb-3 rounded-3xl border border-primary/20 bg-secondary px-4 py-4">
          <AppText variant="body" className="font-bengali-bold text-primary">
            কোন জেমা চালাবেন?
          </AppText>
          <AppText variant="caption" className="mt-1 leading-6">
            ডাউনলোড করা মডেল থেকে একটি বেছে নিন — সহকারী সেটাই ব্যবহার করবে।
          </AppText>
          <View className="mt-3 gap-2">
            {installedLlms.map((item) => {
              const selected =
                activeId === item.id ||
                (!activeId && preferredId === item.id);
              const busy = busyId === item.id;
              return (
                <Pressable
                  key={`pick-${item.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => void handleSelect(item)}
                  className={`flex-row items-center gap-3 rounded-2xl border px-3 py-3 ${
                    selected
                      ? "border-primary bg-white"
                      : "border-border bg-white/80"
                  }`}
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selected ? "border-primary" : "border-muted"
                    }`}
                  >
                    {selected ? (
                      <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <AppText
                      variant="body"
                      className={`font-bengali-semibold ${
                        selected ? "text-primary" : "text-ink"
                      }`}
                    >
                      {item.nameBn}
                    </AppText>
                    <AppText variant="caption">
                      {item.sizeMb} MB
                      {item.recommended ? " · সুপারিশকৃত" : ""}
                      {activeId === item.id ? " · এখন মেমোরিতে" : ""}
                    </AppText>
                  </View>
                  {busy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <AppText variant="caption" className="text-primary">
                      {selected ? "নির্বাচিত" : "বেছে নিন"}
                    </AppText>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <FlatList
        data={MODEL_CATALOG}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <AppText variant="body" className="mb-2 font-bengali-bold text-ink">
            সব মডেল
          </AppText>
        }
        ListFooterComponent={
          <View className="mt-6 gap-3 border-t border-border pt-4">
            <AppText variant="bodyLg">ভিশন মডেল</AppText>
            <AppText variant="caption" className="leading-6">
              অ্যাপে ইতিমধ্যে বান্ডেল করা আছে (`assets/models/vision/`)। নিচের
              বাটন শুধু নতুন ট্রেনিং দিয়ে রিপ্লেস করতে। রোগ:{" "}
              {vision.disease ? "আছে" : "নেই"} · হাতিয়ার:{" "}
              {vision.tool ? "আছে" : "নেই"} · class_names:{" "}
              {vision.classNames ? "আছে" : "নেই"}
            </AppText>
            <SecondaryButton
              label="রোগ মডেল আপডেট (.tflite)"
              onPress={() => void importVision("disease")}
            />
            <SecondaryButton
              label="হাতিয়ার মডেল আপডেট (.tflite)"
              onPress={() => void importVision("tool")}
            />
            <SecondaryButton
              label="class_names.json আপডেট"
              onPress={() => void importVision("classNames")}
            />
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        renderItem={({ item }) => {
          const installed = installedMap[item.id];
          const pct = progress[item.id];
          const busy = busyId === item.id;
          const isActiveLlm =
            installed && item.kind === "llm" && activeId === item.id;
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
                {isActiveLlm ? (
                  <AppText variant="caption" className="mt-1 text-primary">
                    এখন চালু আছে
                  </AppText>
                ) : null}
              </View>
              {busy ? (
                <ActivityIndicator color={colors.primary} />
              ) : installed ? (
                <View className="flex-row items-center gap-2">
                  {item.kind === "llm" && activeId !== item.id ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="চালু করুন"
                      onPress={() => void handleSelect(item)}
                      className="rounded-xl bg-primary px-3 py-2"
                    >
                      <AppText variant="caption" className="text-white">
                        চালু
                      </AppText>
                    </Pressable>
                  ) : null}
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
                </View>
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
