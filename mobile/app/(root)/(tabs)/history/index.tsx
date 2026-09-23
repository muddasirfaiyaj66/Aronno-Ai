import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  EmptyState,
  LoanStatusBadge,
  SegmentedTabs,
  SeverityBadge,
} from "@/components/ui";
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
import type {
  DiseaseHistoryEntry,
  HistoryEntry,
  HistoryEntryKind,
  LoanHistoryEntry,
  YieldHistoryEntry,
} from "@/types/history";

type FilterValue = "all" | HistoryEntryKind;

const FILTERS: { id: FilterValue; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "disease", label: "রোগ" },
];

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
    <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-white p-3">
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

function YieldRow({ entry }: { entry: YieldHistoryEntry }) {
  const trendIcon =
    entry.trend === "up"
      ? "trending-up"
      : entry.trend === "down"
        ? "trending-down"
        : "remove";
  const trendColor =
    entry.trend === "up"
      ? "#047857"
      : entry.trend === "down"
        ? "#B42318"
        : colors.muted;

  return (
    <>
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Ionicons name="stats-chart" size={24} color={colors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-end gap-1.5">
          <AppText variant="title" className="text-primary">
            {entry.yieldValue}
          </AppText>
          <AppText variant="caption" className="mb-0.5">
            {entry.yieldUnitBn}
          </AppText>
        </View>
        <AppText variant="caption" className="mt-0.5">
          {entry.cropNameBn} · {entry.dateBn}
        </AppText>
      </View>
      <Ionicons name={trendIcon} size={22} color={trendColor} />
    </>
  );
}

function LoanRow({ entry }: { entry: LoanHistoryEntry }) {
  return (
    <>
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Ionicons name="cash" size={24} color={colors.primary} />
      </View>
      <View className="flex-1">
        <AppText variant="body" className="font-bengali-bold text-ink">
          {entry.amount}
        </AppText>
        <AppText variant="caption" className="mt-0.5">
          {entry.title} · {entry.dateBn}
        </AppText>
      </View>
      <LoanStatusBadge status={entry.status} />
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
        <View className="mt-6 h-3 w-3 rounded-full bg-primary" />
        {!isLast ? <View className="w-px flex-1 bg-neutral-200" /> : null}
      </View>
      <View className="flex-1 pb-4">
        <RowShell onPress={onPress} onDelete={onDelete}>
          {entry.kind === "disease" ? (
            <DiseaseRow entry={entry} />
          ) : entry.kind === "yield" ? (
            <YieldRow entry={entry} />
          ) : (
            <LoanRow entry={entry} />
          )}
        </RowShell>
      </View>
    </View>
  );
}

function isHiddenEntry(entry: HistoryEntry, hidden: Set<string>): boolean {
  if (hidden.has(entry.id)) return true;
  if (entry.kind === "disease" && entry.sourceId && hidden.has(entry.sourceId)) {
    return true;
  }
  return false;
}

export default function CropHealthHistoryScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [localEntries, setLocalEntries] = useState<HistoryEntry[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [deleteHistoryEntry] = useDeleteHistoryEntryMutation();

  const { data: remote = [], refetch: refetchRemote } = useGetHistoryQuery(
    filter === "all" ? undefined : { kind: filter },
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
      if (e.kind === "disease" && e.sourceId) {
        const localMatch = [...byKey.values()].find(
          (x) =>
            x.kind === "disease" &&
            (x.id === e.sourceId || x.sourceId === e.sourceId),
        );
        if (localMatch) continue;
      }
      if (!byKey.has(e.id)) byKey.set(e.id, e);
    }
    return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [localEntries, remote, hiddenIds]);

  const filteredEntries = useMemo(
    () =>
      (filter === "all"
        ? merged
        : merged.filter((entry) => entry.kind === filter)
      ).filter((entry) => entry.kind === "disease"),
    [merged, filter],
  );

  const confirmDelete = (entry: HistoryEntry) => {
    const title =
      entry.kind === "disease" ? entry.diseaseNameBn : "এই রেকর্ড";
    Alert.alert("মুছে ফেলবেন?", `"${title}" ইতিহাস থেকে মুছে যাবে।`, [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const ids = [entry.id];
            if (entry.kind === "disease" && entry.sourceId) {
              ids.push(entry.sourceId);
            }
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
                    entry.kind === "disease" &&
                    e.kind === "disease" &&
                    entry.sourceId &&
                    (e.id === entry.sourceId || e.sourceId === entry.sourceId)
                  ),
              ),
            );

            if (entry.kind === "disease") {
              await deleteLocalDiagnosis(entry.id).catch(() => undefined);
              if (entry.sourceId && entry.sourceId !== entry.id) {
                await deleteLocalDiagnosis(entry.sourceId).catch(
                  () => undefined,
                );
              }
            }

            if (online) {
              const remoteIds = [entry.id];
              if (entry.kind === "disease" && entry.sourceId) {
                remoteIds.push(entry.sourceId);
              }
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
      <View className="border-b border-border bg-white px-5 py-3.5">
        <AppText variant="title">ইতিহাস</AppText>
        <AppText variant="caption" className="mt-0.5">
          স্ক্যান ও রোগ শনাক্তের রেকর্ড — মুছুন চাপলে মুছে যাবে
          {pending > 0
            ? ` · অপেক্ষমাণ ${pending}${syncing ? " (সিঙ্ক হচ্ছে…)" : ""}`
            : syncing
              ? " · সিঙ্ক হচ্ছে…"
              : ""}
        </AppText>
        <SegmentedTabs
          className="mt-3"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {filteredEntries.length === 0 ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            icon={<Ionicons name="time" size={32} color={colors.primary} />}
            message="এই বিভাগে এখনো কোনো ইতিহাস নেই।"
            ctaLabel="সব দেখুন"
            onCta={() => setFilter("all")}
          />
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-5 pb-24"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {filteredEntries.map((entry, index) => (
            <TimelineItem
              key={entry.id}
              entry={entry}
              isLast={index === filteredEntries.length - 1}
              onPress={() =>
                router.push({
                  pathname: "/(root)/(tabs)/history/[id]",
                  params: { id: entry.id },
                })
              }
              onDelete={
                entry.kind === "disease"
                  ? () => confirmDelete(entry)
                  : undefined
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
