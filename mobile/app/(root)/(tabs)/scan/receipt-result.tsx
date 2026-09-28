import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  ListenButton,
  PrimaryButton,
  RetryCard,
  ScreenHeader,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGetReceiptQuery, useReviewReceiptMutation } from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { formatTakaBn, parseNumberInput } from "@/utils/number";
import type {
  ReceiptItem,
  ReceiptReviewItem,
  ReceiptSummary,
} from "@/types/receipt";

type DraftItem = {
  key: string;
  nameBn: string;
  quantity: string;
  /** Raw text so Bangla digits can be typed. */
  price: string;
};

function parseOfflineSummary(params: {
  id?: string;
  totalBdt?: string;
  summaryBn?: string;
  itemsJson?: string;
}): ReceiptSummary | null {
  if (!params.summaryBn && !params.totalBdt) return null;
  let items: ReceiptItem[] = [];
  if (params.itemsJson) {
    try {
      const parsed = JSON.parse(params.itemsJson) as ReceiptItem[];
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }
  }
  return {
    id: params.id ?? "offline-receipt",
    totalBdt: Number(params.totalBdt) || 0,
    summaryBn: params.summaryBn ?? "রসিদের সারাংশ।",
    items,
  };
}

function itemTaka(item: ReceiptItem) {
  if (typeof item.priceBdt === "number") return item.priceBdt;
  const n = parseNumberInput(item.price);
  return Number.isFinite(n) ? n : 0;
}

function toDraft(summary: ReceiptSummary): DraftItem[] {
  return summary.items.map((item, i) => {
    const taka = itemTaka(item);
    return {
      key: `${item.id}-${i}`,
      nameBn: item.nameBn,
      quantity: item.quantity === "—" ? "" : item.quantity,
      price: taka > 0 ? formatTakaBn(taka).replace(/,/g, "") : "",
    };
  });
}

function draftTaka(item: DraftItem) {
  const n = parseNumberInput(item.price);
  return Number.isFinite(n) ? n : NaN;
}

/** Same wording as the server summary, for offline receipts. */
function localSummary(totalBdt: number, items: ReceiptReviewItem[]) {
  const top = [...items].sort((a, b) => b.priceBdt - a.priceBdt)[0];
  const head = `মোট ${formatTakaBn(totalBdt)} টাকা খরচ হয়েছে।`;
  return top && top.priceBdt > 0
    ? `${head} সবচেয়ে বেশি খরচ ${top.nameBn}-এ, ${formatTakaBn(top.priceBdt)} টাকা।`
    : head;
}

export default function ReceiptResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    offline?: string;
    totalBdt?: string;
    summaryBn?: string;
    itemsJson?: string;
  }>();
  const isOffline = params.offline === "1";

  const offlineSummary = useMemo(
    () => (isOffline ? parseOfflineSummary(params) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOffline, params.id],
  );

  const { data: remote, isLoading } = useGetReceiptQuery(params.id!, {
    skip: !params.id || isOffline,
  });
  const [reviewReceipt, { isLoading: saving }] = useReviewReceiptMutation();

  const [confirmed, setConfirmed] = useState<ReceiptSummary | null>(null);
  const [editing, setEditing] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const summary = confirmed ?? offlineSummary ?? remote ?? null;

  // Unchecked AI reads open in the edit step; reviewed receipts open as a result.
  useEffect(() => {
    if (!summary || editing !== null) return;
    setDraft(toDraft(summary));
    setEditing(!summary.reviewed);
  }, [summary, editing]);

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setDraft((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const draftTotal = draft.reduce((acc, d) => {
    const n = draftTaka(d);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const invalid = draft.some(
    (d) => !d.nameBn.trim() || !Number.isFinite(draftTaka(d)),
  );
  const canSave = draft.length > 0 && !invalid;

  const save = async () => {
    if (!summary || !canSave) return;
    setSaveError(null);
    const items: ReceiptReviewItem[] = draft.map((d) => ({
      nameBn: d.nameBn.trim(),
      quantity: d.quantity.trim(),
      priceBdt: Math.round(draftTaka(d)),
    }));
    if (isOffline) {
      const totalBdt = items.reduce((acc, i) => acc + i.priceBdt, 0);
      setConfirmed({
        id: summary.id,
        totalBdt,
        summaryBn: localSummary(totalBdt, items),
        reviewed: true,
        items: items.map((i, idx) => ({
          id: `ri_${idx}`,
          nameBn: i.nameBn,
          quantity: i.quantity || "—",
          price: `৳ ${formatTakaBn(i.priceBdt)}`,
          priceBdt: i.priceBdt,
        })),
      });
      setEditing(false);
      return;
    }
    try {
      const saved = await reviewReceipt({ id: summary.id, items }).unwrap();
      setConfirmed(saved);
      setEditing(false);
    } catch (err) {
      setSaveError(userFacingError(err, "generic", "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"));
    }
  };

  if (!offlineSummary && isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6" edges={["top"]}>
        <AIGeneratingShimmer label="রসিদের হিসাব আনা হচ্ছে" lines={4} className="w-full" />
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-neutral px-6"
        edges={["top"]}
      >
        <EmptyState
          icon={
            <Ionicons name="alert-circle-outline" size={32} color={colors.primary} />
          }
          message="এই তথ্য পাওয়া যায়নি।"
          ctaLabel="ফিরে যান"
          onCta={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
        <ScreenHeader
          title="রসিদ মিলিয়ে নিন"
          subtitle="ভুল পড়া নাম বা টাকা ঠিক করে তারপর সংরক্ষণ করুন"
        />
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 py-5 pb-16"
          keyboardShouldPersistTaps="handled"
        >
          {summary.totalsMismatch ? (
            <View className="flex-row items-start gap-3 rounded-2xl bg-severity-medium-bg px-4 py-3">
              <Ionicons name="warning" size={20} color="#B54708" />
              <AppText variant="body" className="flex-1 leading-6 text-ink">
                রসিদের মোট (৳ {formatTakaBn(summary.totalBdt)}) আর আইটেমের যোগফল মিলছে
                না — প্রতিটি টাকার অঙ্ক একবার দেখে নিন।
              </AppText>
            </View>
          ) : null}

          {draft.map((item, index) => {
            const taka = draftTaka(item);
            const unreadable = !item.price.trim() || !Number.isFinite(taka);
            return (
              <View
                key={item.key}
                className="gap-2 rounded-2xl border border-border bg-card p-3"
              >
                <View className="flex-row items-center gap-2">
                  <AppText variant="caption" className="font-bengali-bold text-muted">
                    আইটেম {formatTakaBn(index + 1)}
                  </AppText>
                  <View className="flex-1" />
                  <Pressable
                    onPress={() => setDraft((prev) => prev.filter((d) => d.key !== item.key))}
                    accessibilityRole="button"
                    accessibilityLabel="আইটেম মুছুন"
                    hitSlop={8}
                    className="min-h-touch min-w-[52px] items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={20} color="#B42318" />
                  </Pressable>
                </View>
                <TextInput
                  value={item.nameBn}
                  onChangeText={(t) => updateItem(item.key, { nameBn: t })}
                  placeholder="পণ্যের নাম"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="পণ্যের নাম"
                  className="min-h-touch rounded-xl bg-neutral px-3 font-bengali-medium text-body text-ink"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={item.quantity}
                    onChangeText={(t) => updateItem(item.key, { quantity: t })}
                    placeholder="পরিমাণ"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="পরিমাণ"
                    className="min-h-touch flex-1 rounded-xl bg-neutral px-3 font-bengali-medium text-body text-ink"
                  />
                  <View
                    className={`min-h-touch flex-1 flex-row items-center rounded-xl px-3 ${
                      unreadable ? "border border-severity-high bg-severity-high-bg" : "bg-neutral"
                    }`}
                  >
                    <AppText variant="body" className="text-muted">
                      ৳
                    </AppText>
                    <TextInput
                      value={item.price}
                      onChangeText={(t) => updateItem(item.key, { price: t })}
                      keyboardType="decimal-pad"
                      placeholder="টাকা"
                      placeholderTextColor={colors.muted}
                      accessibilityLabel="দাম, টাকা"
                      className="min-h-touch flex-1 px-2 font-bengali-medium text-body text-ink"
                    />
                  </View>
                </View>
                {unreadable ? (
                  <AppText variant="caption" className="text-severity-high">
                    টাকার অঙ্ক পড়া যায়নি — রসিদ দেখে লিখুন।
                  </AppText>
                ) : null}
              </View>
            );
          })}

          <SecondaryButton
            label="আইটেম যোগ করুন"
            onPress={() =>
              setDraft((prev) => [
                ...prev,
                { key: `new-${Date.now()}`, nameBn: "", quantity: "", price: "" },
              ])
            }
            icon={<Ionicons name="add" size={20} color={colors.ink} />}
          />

          <View className="flex-row items-center justify-between rounded-2xl bg-secondary px-4 py-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              মোট
            </AppText>
            <AppText variant="title" className="text-primary">
              ৳ {formatTakaBn(draftTotal)}
            </AppText>
          </View>

          {saveError ? <RetryCard message={saveError} onRetry={save} /> : null}

          <PrimaryButton
            label="ঠিক আছে, সংরক্ষণ করুন"
            onPress={save}
            loading={saving}
            disabled={!canSave}
            icon={<Ionicons name="checkmark" size={20} color={colors.white} />}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="রসিদের হিসাব"
        subtitle={
          isOffline
            ? "অফলাইন — ছবি থেকে খরচ"
            : "ছবি থেকে খরচ — চাইলে বাংলায় শুনুন"
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-16"
      >
        <StructuredCard
          title="মোট খরচ"
          icon={<Ionicons name="receipt" size={22} color={colors.primary} />}
          footer={
            <ListenButton
              label="সারাংশ বাংলায় শুনুন"
              textBn={summary.summaryBn}
            />
          }
        >
          <View className="gap-4">
            <AppText variant="hero">
              ৳ {formatTakaBn(summary.totalBdt)}
            </AppText>
            <AppText variant="body" className="leading-8 text-ink">
              {summary.summaryBn}
            </AppText>
            {summary.items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3"
              >
                <View className="flex-1 pr-3">
                  <AppText variant="body" className="font-bengali-semibold">
                    {item.nameBn}
                  </AppText>
                  <AppText variant="caption" className="text-muted">
                    পরিমাণ: {item.quantity}
                  </AppText>
                </View>
                <AppText variant="body" className="font-bengali-semibold">
                  {item.price}
                </AppText>
              </View>
            ))}
          </View>
        </StructuredCard>

        <SecondaryButton
          label="সংশোধন করুন"
          onPress={() => {
            setDraft(toDraft(summary));
            setEditing(true);
          }}
          icon={<Ionicons name="create-outline" size={20} color={colors.ink} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
