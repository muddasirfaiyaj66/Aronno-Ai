import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { AppText, ScreenHeader, SecondaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  MODEL_CATALOG,
  type ModelCatalogEntry,
} from "@/lib/modelManager/catalog";
import {
  cancelDownload,
  deleteModel,
  type DownloadSnapshot,
  getDownloadSnapshot,
  hydratePausedDownloads,
  isInstalled,
  pauseDownload,
  resumeDownload,
  startModelDownload,
  storageUsedMb,
  subscribeDownloads,
} from "@/lib/modelManager/modelManager";
import {
  currentModelId,
  selectLlm,
  subscribeLlmLoad,
  unloadLlm,
} from "@/lib/modelManager/llmEngine";
import {
  clearPreferredLlmId,
  getPreferredLlmId,
  setPreferredLlmId,
} from "@/lib/modelManager/preferredLlm";
import {
  pickAndInstallVision,
  visionInstallStatus,
} from "@/lib/offlineVision/importModel";

function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <View className="mt-2 h-2 overflow-hidden rounded-full bg-border">
      <View
        className="h-full rounded-full bg-primary"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}

function ActionChip({
  label,
  onPress,
  tone = "primary",
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "muted" | "danger";
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const bg =
    tone === "primary"
      ? "bg-primary"
      : tone === "danger"
        ? "bg-harvestSoft"
        : "bg-secondary";
  const text =
    tone === "primary"
      ? "text-white"
      : tone === "danger"
        ? "text-harvest"
        : "text-ink";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch flex-row items-center justify-center gap-1 rounded-xl px-3 py-2 ${bg} ${
        disabled ? "opacity-50" : "active:opacity-80"
      }`}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={
            tone === "primary"
              ? "#fff"
              : tone === "danger"
                ? "#B7791F"
                : colors.ink
          }
        />
      ) : null}
      <AppText variant="caption" className={`font-bengali-semibold ${text}`}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ModelCard({
  item,
  installed,
  active,
  download,
  busySelect,
  onDownload,
  onPause,
  onResume,
  onCancel,
  onSelect,
  onDelete,
}: {
  item: ModelCatalogEntry;
  installed: boolean;
  active: boolean;
  download: DownloadSnapshot | null;
  busySelect: boolean;
  onDownload: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const phase = download?.phase ?? "idle";
  const inFlight =
    phase === "downloading" ||
    phase === "paused" ||
    phase === "verifying" ||
    phase === "error";
  const progress = download?.progress ?? 0;
  const pct = Math.round(progress * 100);

  let statusLine: string | null = null;
  if (phase === "downloading") {
    statusLine =
      download?.fileCount && download.fileCount > 1
        ? `ডাউনলোড হচ্ছে… ${pct}% · ফাইল ${Math.min(download.fileIndex + 1, download.fileCount)}/${download.fileCount}`
        : `ডাউনলোড হচ্ছে… ${pct}%`;
  } else if (phase === "paused") {
    statusLine = download?.messageBn ?? `থামানো · ${pct}%`;
  } else if (phase === "verifying") {
    statusLine = "যাচাই করা হচ্ছে…";
  } else if (phase === "error") {
    statusLine = download?.messageBn ?? "ডাউনলোড ব্যর্থ";
  } else if (phase === "done" && installed) {
    statusLine = "প্রস্তুত";
  } else if (active) {
    statusLine = "এখন চালু আছে";
  }

  return (
    <View className="mb-3 rounded-2xl border border-border bg-white p-4">
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
          <Ionicons
            name={
              item.kind === "llm"
                ? "sparkles-outline"
                : item.kind === "stt"
                  ? "mic-outline"
                  : item.kind === "tts"
                    ? "volume-high-outline"
                    : "eye-outline"
            }
            size={20}
            color={colors.primary}
          />
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="body" className="font-bengali-bold text-ink">
            {item.nameBn}
          </AppText>
          <AppText variant="caption" className="mt-0.5 leading-5">
            {item.nameEn} · ~{item.sizeMb} MB · RAM {item.minRamMb}+
            {item.multimodal ? " · ছবি+লেখা" : ""}
            {item.recommended ? " · সুপারিশকৃত" : ""}
          </AppText>
        </View>
      </View>

      {statusLine ? (
        <AppText
          variant="caption"
          className={`mt-3 ${
            phase === "error"
              ? "text-harvest"
              : phase === "paused"
                ? "text-harvest"
                : "text-forest600"
          }`}
        >
          {statusLine}
        </AppText>
      ) : null}

      {inFlight ? (
        <ProgressBar
          progress={phase === "verifying" ? 0.99 : Math.min(progress, 0.99)}
        />
      ) : null}

      <View className="mt-3 flex-row flex-wrap gap-2">
        {phase === "downloading" || phase === "verifying" ? (
          <>
            <ActionChip
              label="থামান"
              icon="pause"
              tone="muted"
              onPress={onPause}
              disabled={phase === "verifying"}
            />
            <ActionChip
              label="বাতিল"
              icon="close"
              tone="danger"
              onPress={onCancel}
            />
          </>
        ) : null}

        {phase === "paused" || phase === "error" ? (
          <>
            <ActionChip
              label="চালিয়ে যান"
              icon="play"
              onPress={onResume}
            />
            <ActionChip
              label="বাতিল"
              icon="close"
              tone="danger"
              onPress={onCancel}
            />
          </>
        ) : null}

        {!inFlight && !installed ? (
          <ActionChip
            label="ডাউনলোড"
            icon="cloud-download-outline"
            onPress={onDownload}
          />
        ) : null}

        {installed && !inFlight ? (
          <>
            {item.kind === "llm" && active ? (
              <View className="min-h-touch flex-row items-center rounded-xl bg-secondary px-3 py-2">
                <AppText
                  variant="caption"
                  className="font-bengali-semibold text-primary"
                >
                  চালু আছে
                </AppText>
              </View>
            ) : null}
            {item.kind === "llm" && !active ? (
              <ActionChip
                label={busySelect ? "লোড…" : "চালু করুন"}
                icon="checkmark-circle-outline"
                onPress={onSelect}
                disabled={busySelect}
              />
            ) : null}
            <ActionChip
              label="মুছুন"
              icon="trash-outline"
              tone="danger"
              onPress={onDelete}
            />
          </>
        ) : null}

        {(phase === "downloading" || phase === "verifying") && (
          <View className="min-h-touch justify-center px-1">
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>
    </View>
  );
}

export default function ModelsScreen() {
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadSnapshot>>(
    {},
  );
  const [busySelectId, setBusySelectId] = useState<string | null>(null);
  const [usedMb, setUsedMb] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
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
    void (async () => {
      await hydratePausedDownloads();
      // Seed UI with any known snapshots (paused jobs)
      const seed: Record<string, DownloadSnapshot> = {};
      for (const entry of MODEL_CATALOG) {
        const snap = getDownloadSnapshot(entry.id);
        if (snap) seed[entry.id] = snap;
      }
      if (Object.keys(seed).length) setDownloads(seed);
      await refresh();
      // Do NOT auto-load Gemma on screen open — that OOMs mid-range phones and
      // kills the whole app (chat looks “broken”). Farmer taps «চালু করুন».
    })();
  }, [refresh]);

  useEffect(() => {
    let lastPhase: Record<string, string> = {};
    return subscribeDownloads((snap) => {
      setDownloads((prev) => ({ ...prev, [snap.modelId]: snap }));
      const prevPhase = lastPhase[snap.modelId];
      lastPhase = { ...lastPhase, [snap.modelId]: snap.phase };
      if (snap.phase !== "done" || prevPhase === "done") return;
      void (async () => {
        await refresh();
        const entry = MODEL_CATALOG.find((e) => e.id === snap.modelId);
        if (!entry) return;
        if (entry.kind === "llm") {
          // Large multimodal packs often OOM if loaded immediately after download.
          // Remember preference; only eager-load smaller models.
          await setPreferredLlmId(entry.id);
          setPreferredId(entry.id);
          if (entry.sizeMb <= 900) {
            const loaded = await selectLlm(entry.id);
            setActiveId(loaded);
            setBanner({
              tone: loaded ? "ok" : "err",
              text: loaded
                ? `${entry.nameBn} চালু হয়েছে — সহকারী ট্যাবে ব্যবহার করুন।`
                : "ফাইল আছে, কিন্তু মেমোরিতে লোড হয়নি। ছোট জেমা বেছে নিন।",
            });
          } else {
            setBanner({
              tone: "ok",
              text: `${entry.nameBn} ডাউনলোড সম্পন্ন। «চালু করুন» চাপলে মেমোরিতে লোড হবে (বেশি RAM লাগতে পারে)।`,
            });
          }
        } else if (entry.kind === "stt") {
          // Do not ASR.initialize here — native init can abort the process.
          // Engine warms on first listen in chat / voice scan.
          setBanner({
            tone: "ok",
            text: "বাংলা কণ্ঠ মডেল ডাউনলোড হয়েছে — সহকারীতে মাইক চাপলে চালু হবে।",
          });
        } else if (entry.kind === "tts") {
          setBanner({
            tone: "ok",
            text: "কণ্ঠ উচ্চারণ ডিভাইস TTS দিয়ে চলবে।",
          });
        }
      })();
    });
  }, [refresh]);

  // Auto-pause on offline; auto-resume network pauses when back online
  useEffect(() => {
    let wasOffline = false;
    const unsub = NetInfo.addEventListener((state) => {
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      if (!online) {
        wasOffline = true;
        for (const entry of MODEL_CATALOG) {
          const snap = getDownloadSnapshot(entry.id);
          if (snap?.phase === "downloading") {
            void pauseDownload(entry.id, "network");
          }
        }
        return;
      }
      if (!wasOffline) return;
      wasOffline = false;
      for (const entry of MODEL_CATALOG) {
        const snap = getDownloadSnapshot(entry.id);
        if (
          snap &&
          (snap.phase === "paused" || snap.phase === "error") &&
          snap.pauseReason !== "user"
        ) {
          resumeDownload(entry.id);
        }
      }
    });
    return () => unsub();
  }, []);

  const installedLlms = useMemo(
    () => MODEL_CATALOG.filter((e) => e.kind === "llm" && installedMap[e.id]),
    [installedMap],
  );

  async function handleSelect(entry: ModelCatalogEntry) {
    setBanner(null);
    setBusySelectId(entry.id);
    const unsub = subscribeLlmLoad((p) => {
      if (p.modelId !== entry.id) return;
      if (p.messageBn) {
        setBanner({
          tone: p.phase === "error" ? "err" : "ok",
          text: p.messageBn,
        });
      }
    });
    try {
      const loaded = await selectLlm(entry.id);
      setActiveId(loaded);
      setPreferredId(entry.id);
      setBanner({
        tone: loaded ? "ok" : "err",
        text: loaded
          ? `${entry.nameBn} চালু — সহকারীতে মডেল উত্তর দিবে।`
          : "লোড ব্যর্থ। RAM কম হলে ছোট মডেল (২৭০এম) বেছে নিন।",
      });
    } catch {
      setBanner({ tone: "err", text: "মডেল লোড যায়নি। আবার চেষ্টা করুন।" });
    } finally {
      unsub();
      setBusySelectId(null);
      await refresh();
    }
  }

  async function handleDelete(entry: ModelCatalogEntry) {
    setBanner(null);
    try {
      if (entry.kind === "llm" && currentModelId() === entry.id) {
        await unloadLlm();
      }
      await deleteModel(entry);
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      if (preferredId === entry.id) {
        await clearPreferredLlmId();
        const next = MODEL_CATALOG.find(
          (e) => e.kind === "llm" && e.id !== entry.id && installedMap[e.id],
        );
        if (next) await selectLlm(next.id);
      }
      await refresh();
    } catch {
      setBanner({ tone: "err", text: "মুছে ফেলা যায়নি। আবার চেষ্টা করুন।" });
    }
  }

  async function importVision(kind: "disease" | "tool" | "classNames") {
    setBanner(null);
    const result = await pickAndInstallVision(kind);
    setBanner({
      tone: result.ok ? "ok" : "err",
      text: result.messageBn,
    });
    if (result.ok) await refresh();
  }

  const activeName =
    MODEL_CATALOG.find((e) => e.id === (activeId ?? preferredId))?.nameBn ??
    null;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="অফলাইন এআই মডেল"
        subtitle="ডাউনলোড · থামান · চালিয়ে যান · চালু করুন"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-28"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 rounded-2xl border border-border bg-white px-4 py-3">
          <AppText variant="caption" className="leading-5">
            স্টোরেজ ~{usedMb} MB
            {activeName ? ` · চালু: ${activeName}` : ""}
          </AppText>
          {banner ? (
            <AppText
              variant="caption"
              className={`mt-2 leading-5 ${
                banner.tone === "ok" ? "text-primary" : "text-harvest"
              }`}
            >
              {banner.text}
            </AppText>
          ) : (
            <AppText variant="caption" className="mt-1 leading-5 text-muted">
              নেটवर्क কেটে গেলে ডাউনলোড থেমে যাবে — চালিয়ে যান চাপুন, বা
              সংযোগ ফিরলে নিজে থেকে শুরু হবে।
            </AppText>
          )}
        </View>

        {installedLlms.length > 0 ? (
          <View className="mb-4 rounded-2xl border border-primary/20 bg-secondary px-4 py-4">
            <AppText variant="body" className="font-bengali-bold text-primary">
              কোন জেমা চালাবেন?
            </AppText>
            <AppText variant="caption" className="mt-1 leading-5">
              ডাউনলোড করা মডেল থেকে একটি বেছে নিন।
            </AppText>
            <View className="mt-3 gap-2">
              {installedLlms.map((item) => {
                const selected = preferredId === item.id || activeId === item.id;
                const busy = busySelectId === item.id;
                const running = activeId === item.id;
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
                      </AppText>
                    </View>
                    {busy ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <AppText variant="caption" className="text-primary">
                        {running
                          ? "চালু আছে"
                          : selected
                            ? "নির্বাচিত"
                            : "বেছে নিন"}
                      </AppText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <AppText variant="body" className="mb-2 font-bengali-bold text-ink">
          সব মডেল
        </AppText>

        {MODEL_CATALOG.map((item) => (
          <ModelCard
            key={item.id}
            item={item}
            installed={!!installedMap[item.id]}
            active={
              !!installedMap[item.id] &&
              item.kind === "llm" &&
              activeId === item.id
            }
            download={downloads[item.id] ?? null}
            busySelect={busySelectId === item.id}
            onDownload={() => {
              setBanner(null);
              startModelDownload(item);
            }}
            onPause={() => void pauseDownload(item.id)}
            onResume={() => {
              setBanner(null);
              resumeDownload(item.id);
            }}
            onCancel={() => {
              void cancelDownload(item.id).then(() => refresh());
            }}
            onSelect={() => void handleSelect(item)}
            onDelete={() => void handleDelete(item)}
          />
        ))}

        <View className="mt-4 gap-3 border-t border-border pt-4">
          <AppText variant="body" className="font-bengali-bold text-ink">
            ভিশন মডেল
          </AppText>
          <AppText variant="caption" className="leading-5">
            অ্যাপে বান্ডেল করা আছে। নিচের বাটন শুধু নতুন ট্রেনিং দিয়ে
            রিপ্লেস করতে। রোগ: {vision.disease ? "আছে" : "নেই"} · হাতিয়ার:{" "}
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
      </ScrollView>
    </SafeAreaView>
  );
}
