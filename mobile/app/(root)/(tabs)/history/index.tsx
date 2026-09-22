import { useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
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
  useGetHistoryQuery,
} from "@/services/api";
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
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl bg-white p-3"
    >
      {children}
    </Pressable>
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
}: {
  entry: HistoryEntry;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="mt-6 h-3 w-3 rounded-full bg-primary" />
        {!isLast ? <View className="w-px flex-1 bg-neutral-200" /> : null}
      </View>
      <View className="flex-1 pb-4">
        <RowShell onPress={onPress}>
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

export default function CropHealthHistoryScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>("all");
  const { data = [] } = useGetHistoryQuery(
    filter === "all" ? undefined : { kind: filter },
  );

  const sortedEntries = useMemo(
    () => [...data].sort((a, b) => b.date.localeCompare(a.date)),
    [data],
  );

  const filteredEntries = useMemo(
    () =>
      (filter === "all"
        ? sortedEntries
        : sortedEntries.filter((entry) => entry.kind === filter)
      ).filter((entry) => entry.kind === "disease"),
    [sortedEntries, filter],
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">ইতিহাস</AppText>
        <AppText variant="caption" className="mt-1">
          স্ক্যান ও রোগ শনাক্তের রেকর্ড
        </AppText>
        <SegmentedTabs
          className="mt-4"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="time" size={32} color={colors.primary} />}
          message="এই বিভাগে এখনো কোনো ইতিহাস নেই।"
          ctaLabel="সব দেখুন"
          onCta={() => setFilter("all")}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-5"
          showsVerticalScrollIndicator={false}
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
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
