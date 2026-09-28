import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppText, EmptyState, SeverityBadge } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  useDeleteHistoryEntryMutation,
  useGetHistoryQuery,
} from "@/services/api";
import {
  countPendingUploads,
  deleteLocalDiagnosis,
  hideHistoryIds,
  listHiddenHistoryIds,
  listLocalHistory,
} from "@/lib/offlineDb/queries";
import {
  requestSyncSoon,
  subscribeSyncStatus,
} from "@/lib/offlineDb/syncEngine";
import { useIsOnline } from "@/hooks/useIsOnline";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import type { DiseaseHistoryEntry, HistoryEntry } from "@/types/history";

function RowShell({
  onPress,
  onDelete,
  children,
}: {
  onPress: () => void;
  onDelete?: () => void;
  children: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="বিস্তারিত দেখুন"
        className="min-h-touch min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
      >
        {children}
      </Pressable>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="মুছুন"
          hitSlop={8}
          className="min-h-touch min-w-[52px] items-center justify-center rounded-xl bg-harvestSoft px-2"
        >
          <Ionicons name="trash-outline" size={20} color="#B42318" />
          <AppText variant="caption" className="mt-0.5 text-[#B42318]">
            মুছুন
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function DiseaseRow({ entry }: { entry: DiseaseHistoryEntry }) {
  return (
    <>
      {entry.imageUrl ? (
        <Image
          source={{ uri: entry.imageUrl }}
          style={{ height: 56, width: 56, borderRadius: 14 }}
          resizeMode="cover"
        />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <Ionicons name="leaf" size={24} color={colors.primary} />
        </View>
      )}
      <View className="flex-1">
        <AppText
          variant="body"
          numberOfLines={1}
          className="font-bengali-bold text-ink"
        >
          {entry.diseaseNameBn}
        </AppText>
        <AppText variant="caption" className="mt-0.5">
          {entry.cropNameBn} · {entry.dateBn}
        </AppText>
      </View>
      <SeverityBadge level={entry.severity} />
    </>
  );
}

function TimelineItem({
  entry,
  isLast,
  onPress,
  onDelete,
}: {
  entry: HistoryEntry;
  isLast: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="mt-6 h-3 w-3 rounded-full bg-forest-700" />
        {!isLast ? <View className="w-px flex-1 bg-neutral-200" /> : null}
      </View>
      <View className="flex-1 pb-4">
        <RowShell onPress={onPress} onDelete={onDelete}>
          <DiseaseRow entry={entry} />
        </RowShell>
      </View>
    </View>
  );
}

function isHiddenEntry(entry: HistoryEntry, hidden: Set<string>): boolean {
  if (hidden.has(entry.id)) return true;
  return !!entry.sourceId && hidden.has(entry.sourceId);
}

export default function CropHealthHistoryScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const [localEntries, setLocalEntries] = useState<HistoryEntry[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [deleteHistoryEntry] = useDeleteHistoryEntryMutation();

  const { data: remote = [], refetch: refetchRemote } = useGetHistoryQuery(
    undefined,
    { skip: !online },
  );

  const reloadLocal = useCallback(async () => {
    try {
      const [local, pendingCount, hidden] = await Promise.all([
        listLocalHistory(),
        countPendingUploads(),
        listHiddenHistoryIds(),
      ]);
      setLocalEntries(local);
      setPending(pendingCount);
      setHiddenIds(hidden);
    } catch {
      setLocalEntries([]);
      setPending(0);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    await reloadLocal();
    if (online) {
      requestSyncSoon(0);
      await refetchRemote();
      await reloadLocal();
    }
  }, [online, refetchRemote, reloadLocal]);

  const { refreshControl } = usePullToRefresh(refreshHistory);

  useEffect(() => {
    void reloadLocal();
    return subscribeSyncStatus((s) => {
      setPending(s.pending);
      setSyncing(s.syncing);
      void reloadLocal();
    });
  }, [reloadLocal]);

  useEffect(() => {
    if (online) requestSyncSoon(500);
  }, [online]);

  const merged = useMemo(() => {
    const byKey = new Map<string, HistoryEntry>();
    for (const e of localEntries) {
      if (!isHiddenEntry(e, hiddenIds)) byKey.set(e.id, e);
    }
    for (const e of remote) {
      if (isHiddenEntry(e, hiddenIds)) continue;
      // Prefer local row when same diagnosis already listed under localId.
      if (e.sourceId) {
        const localMatch = [...byKey.values()].find(
          (x) => x.id === e.sourceId || x.sourceId === e.sourceId,
        );
        if (localMatch) continue;
      }
      if (!byKey.has(e.id)) byKey.set(e.id, e);
    }
    return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [localEntries, remote, hiddenIds]);

  const confirmDelete = (entry: HistoryEntry) => {
    Alert.alert("মুছে ফেলবেন?", `"${entry.diseaseNameBn}" ইতিহাস থেকে মুছে যাবে।`, [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const ids = [entry.id];
            if (entry.sourceId) ids.push(entry.sourceId);
            await hideHistoryIds(ids);
            setHiddenIds((prev) => {
              const next = new Set(prev);
              ids.forEach((id) => next.add(id));
              return next;
            });
            setLocalEntries((prev) =>
              prev.filter(
                (e) =>
                  e.id !== entry.id &&
                  !(
                    entry.sourceId &&
                    (e.id === entry.sourceId || e.sourceId === entry.sourceId)
                  ),
              ),
            );

            await deleteLocalDiagnosis(entry.id).catch(() => undefined);
            if (entry.sourceId && entry.sourceId !== entry.id) {
              await deleteLocalDiagnosis(entry.sourceId).catch(
                () => undefined,
              );
            }

            if (online) {
              const remoteIds = [entry.id];
              if (entry.sourceId) remoteIds.push(entry.sourceId);
              for (const rid of remoteIds) {
                await deleteHistoryEntry(rid)
                  .unwrap()
                  .catch(() => undefined);
              }
              await refetchRemote().catch(() => undefined);
            }

            await reloadLocal();
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-border bg-card px-5 py-3.5">
        <AppText variant="title">ইতিহাস</AppText>
        <AppText variant="caption" className="mt-0.5">
          স্ক্যান ও রোগ শনাক্তের রেকর্ড — মুছুন চাপলে মুছে যাবে
          {pending > 0
            ? ` · অপেক্ষমাণ ${pending}${syncing ? " (সিঙ্ক হচ্ছে…)" : ""}`
            : syncing
              ? " · সিঙ্ক হচ্ছে…"
              : ""}
        </AppText>
      </View>

      {merged.length === 0 ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            icon={<Ionicons name="time" size={32} color={colors.primary} />}
            message="এখনো কোনো স্ক্যানের ইতিহাস নেই।"
            ctaLabel="পাতা স্ক্যান করুন"
            onCta={() => router.push("/(root)/(tabs)/scan")}
          />
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-5 pb-24"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {merged.map((entry, index) => (
            <TimelineItem
              key={entry.id}
              entry={entry}
              isLast={index === merged.length - 1}
              onPress={() =>
                router.push({
                  pathname: "/(root)/(tabs)/history/[id]",
                  params: { id: entry.id },
                })
              }
              onDelete={() => confirmDelete(entry)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
