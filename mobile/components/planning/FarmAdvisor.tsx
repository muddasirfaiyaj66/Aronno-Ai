import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AIGeneratingShimmer, AppText, RetryCard } from "@/components/ui";
import {
  useAdviseCropsMutation,
  useGetLatestCropAdviceQuery,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";
import { parseNumberInput } from "@/utils/number";
import type { FarmAdvice } from "@/types/planning";
import { EMPTY_DRAFT, FarmAdviceForm, type FarmDraft } from "./FarmAdviceForm";
import { FarmAdviceResult } from "./FarmAdviceResult";

const DRAFT_KEY = "farmAdvisor.draft.v1";

const toBn = (n: number) =>
  new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 }).format(n);

/**
 * "আমার জমির পরামর্শ": the farmer describes their land, last year's crops and
 * the crops they want; the backend ranks crops for the next 6 months against
 * the local weather outlook.
 */
export function FarmAdvisor({
  coords,
  onScrollTop,
}: {
  /** GPS point when allowed; otherwise the backend uses the profile district. */
  coords?: { lat: number; lon: number } | null;
  onScrollTop?: () => void;
}) {
  const { data: latest, isLoading } = useGetLatestCropAdviceQuery();
  const [advise, { isLoading: submitting }] = useAdviseCropsMutation();
  const [draft, setDraft] = useState<FarmDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<FarmAdvice | null>(null);
  const loaded = useRef(false);

  // Prefill from this phone's saved answers, else from the last advice.
  useEffect(() => {
    if (loaded.current || isLoading) return;
    loaded.current = true;
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (raw) return setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(raw) as FarmDraft) });
        const input = latest?.input;
        if (input) {
          setDraft({
            ...EMPTY_DRAFT,
            ...input,
            landSize: String(input.landSize),
          });
        }
      })
      .catch(() => {});
  }, [isLoading, latest]);

  const updateDraft = (next: FarmDraft) => {
    setDraft(next);
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next)).catch(() => {});
  };

  const submit = async () => {
    setError(null);
    const landSize = parseNumberInput(draft.landSize);
    if (!(landSize > 0)) return;
    try {
      const result = await advise({
        landSize,
        landUnit: draft.landUnit,
        landType: draft.landType,
        pastCrops: draft.pastCrops,
        wantedCrops: draft.wantedCrops,
        goal: draft.goal,
        ...(coords ?? {}),
      }).unwrap();
      setFresh(result);
      setEditing(false);
      onScrollTop?.();
    } catch (err) {
      setError(
        userFacingError(err, "generic", "পরামর্শ তৈরি করা যায়নি। আবার চেষ্টা করুন।"),
      );
    }
  };

  const advice = fresh ?? latest ?? null;
  const landSize = parseNumberInput(draft.landSize);
  const landLabel =
    landSize > 0
      ? `${toBn(landSize)} ${draft.landUnit === "acre" ? "একর" : "বিঘা"}`
      : undefined;

  if (isLoading) {
    return <AIGeneratingShimmer label="আগের পরামর্শ খোঁজা হচ্ছে" lines={3} />;
  }

  if (submitting) {
    return (
      <View className="gap-3">
        <AIGeneratingShimmer
          label="আপনার জমি ও আবহাওয়া বিশ্লেষণ হচ্ছে"
          lines={6}
          className="w-full"
        />
        <AppText variant="caption" className="px-1 text-muted">
          ৬ মাসের পূর্বাভাস, আগের ফসল ও আপনার পছন্দ মিলিয়ে দেখা হচ্ছে…
        </AppText>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {error ? <RetryCard message={error} onRetry={submit} /> : null}
      {advice && !editing ? (
        <FarmAdviceResult
          advice={advice}
          landLabel={landLabel}
          onEdit={() => {
            setEditing(true);
            onScrollTop?.();
          }}
          onRefresh={submit}
          refreshing={submitting}
        />
      ) : (
        <>
          {!advice ? (
            <View className="gap-1 px-1">
              <AppText variant="subtitle">আপনার জমির জন্য কোন ফসল ভালো?</AppText>
              <AppText variant="caption">
                ৩টি সহজ প্রশ্নের উত্তর দিন। আপনার এলাকার আগামী ৬ মাসের আবহাওয়া আর আগের চাষ
                মিলিয়ে সেরা ফসল জানিয়ে দেব।
              </AppText>
            </View>
          ) : null}
          <FarmAdviceForm
            draft={draft}
            onChange={updateDraft}
            onSubmit={submit}
            submitting={submitting}
          />
        </>
      )}
    </View>
  );
}
