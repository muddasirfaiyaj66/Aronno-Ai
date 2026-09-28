import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  IconPickerRow,
  LandSizeInput,
  ListenButton,
  PrimaryButton,
  RetryCard,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { CROP_OPTIONS, cropLabel } from "@/constants/crops";
import type { CropType, LandUnit } from "@/types/treatment";
import type {
  DiseaseStatus,
  FertilizerAdvice,
  GrowthStage,
  SoilColor,
  SoilMoisture,
} from "@/types/fertilizer";
import type { DiseaseHistoryEntry } from "@/types/history";
import { useGetHistoryQuery, useRecommendFertilizerMutation } from "@/services/api";
import { listLocalHistory } from "@/lib/offlineDb/queries";
import { useIsOnline } from "@/hooks/useIsOnline";
import { userFacingError } from "@/lib/userFacingError";
import { parseNumberInput } from "@/utils/number";

const BIGHA_PER_ACRE = 3;
/** A diagnosis older than this is not treated as the crop's current disease. */
const RECENT_DIAGNOSIS_DAYS = 60;

const STAGE_OPTIONS: {
  id: GrowthStage;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "seedling", label: "চারা", icon: "leaf-outline" },
  { id: "vegetative", label: "বৃদ্ধি", icon: "trending-up-outline" },
  { id: "flowering", label: "ফুল", icon: "flower-outline" },
  { id: "maturity", label: "পরিপক্ব", icon: "checkmark-circle-outline" },
];

/** Age (days) at which each crop leaves seedling / vegetative / flowering. */
const STAGE_AGE_LIMITS: Record<CropType, [number, number, number]> = {
  rice: [20, 50, 85],
  potato: [25, 50, 75],
  tomato: [20, 45, 80],
  vegetable: [15, 35, 60],
  onion: [25, 60, 90],
  mustard: [20, 35, 60],
  lentil: [20, 45, 75],
  corn: [25, 55, 85],
};

function stageForAge(crop: CropType, days: number): GrowthStage {
  const [seedling, vegetative, flowering] = STAGE_AGE_LIMITS[crop];
  if (days < seedling) return "seedling";
  if (days < vegetative) return "vegetative";
  if (days < flowering) return "flowering";
  return "maturity";
}

const AGE_PRESETS = [15, 30, 45, 60, 90];

const SOIL_COLOR_OPTIONS: { id: SoilColor; label: string; swatch: string }[] = [
  { id: "dark", label: "গাঢ়", swatch: "#3F2A1D" },
  { id: "medium", label: "মাঝারি", swatch: "#8B5E34" },
  { id: "light", label: "হালকা", swatch: "#C8A874" },
];

const MOISTURE_OPTIONS: {
  id: SoilMoisture;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "wet", label: "ভেজা", icon: "water" },
  { id: "moist", label: "স্যাঁতসেঁতে", icon: "water-outline" },
  { id: "dry", label: "শুকনো", icon: "sunny-outline" },
];

const DISEASE_OPTIONS: {
  id: DiseaseStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "yes", label: "আছে", icon: "warning-outline" },
  { id: "no", label: "নেই", icon: "checkmark-circle-outline" },
  { id: "unsure", label: "জানি না", icon: "help-circle-outline" },
];

const toBnDigits = (n: number) => new Intl.NumberFormat("bn-BD").format(n);

/** Newest recent diagnosis, preferring one recorded for the chosen crop. */
function latestRelevantDiagnosis(
  entries: DiseaseHistoryEntry[],
  crop: CropType | null,
): DiseaseHistoryEntry | null {
  const cutoff = new Date(Date.now() - RECENT_DIAGNOSIS_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recent = entries
    .filter((e) => e.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date));
  const label = cropLabel(crop);
  return (
    (label ? recent.find((e) => e.cropNameBn.includes(label)) : undefined) ??
    recent[0] ??
    null
  );
}

function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={String(option.id)}
            onPress={() => onChange(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            className={`min-h-touch items-center justify-center rounded-full border px-4 ${
              selected ? "border-primary bg-forest-700" : "border-border bg-card"
            }`}
          >
            <AppText
              variant="caption"
              className={`font-bengali-bold ${selected ? "text-white" : "text-ink"}`}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FertilizerRecommendationScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const [crop, setCrop] = useState<CropType | null>(null);
  const [landSize, setLandSize] = useState("");
  const [landUnit, setLandUnit] = useState<LandUnit>("bigha");
  const [cropAgeDays, setCropAgeDays] = useState("");
  const [hasDisease, setHasDisease] = useState<DiseaseStatus | null>(null);
  const [useLatestDiagnosis, setUseLatestDiagnosis] = useState(true);
  const [stage, setStage] = useState<GrowthStage | null>(null);
  const [stageTouched, setStageTouched] = useState(false);
  const [soilColor, setSoilColor] = useState<SoilColor | null>(null);
  const [soilMoisture, setSoilMoisture] = useState<SoilMoisture | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [advice, setAdvice] = useState<FertilizerAdvice | null>(null);
  const [recommend, { isLoading }] = useRecommendFertilizerMutation();
  const [aiError, setAiError] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<DiseaseHistoryEntry[]>([]);

  const { data: remoteHistory = [] } = useGetHistoryQuery(undefined, {
    skip: !online,
  });

  useEffect(() => {
    listLocalHistory()
      .then(setLocalHistory)
      .catch(() => setLocalHistory([]));
  }, []);

  const latestDiagnosis = useMemo(
    () => latestRelevantDiagnosis([...remoteHistory, ...localHistory], crop),
    [remoteHistory, localHistory, crop],
  );

  const landNum = parseNumberInput(landSize);
  const ageNum = parseNumberInput(cropAgeDays);
  const landOk = Number.isFinite(landNum) && landNum > 0;
  const ageOk = Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 400;
  const suggestedStage = crop && ageOk ? stageForAge(crop, ageNum) : null;

  // Age implies a stage; keep it in sync until the farmer picks one by hand.
  useEffect(() => {
    if (!stageTouched && suggestedStage) setStage(suggestedStage);
  }, [stageTouched, suggestedStage]);

  const linkedDiagnosis =
    hasDisease === "yes" && useLatestDiagnosis ? latestDiagnosis : null;

  const canSubmit =
    !!crop &&
    landOk &&
    ageOk &&
    !!hasDisease &&
    !!stage &&
    !!soilColor &&
    !!soilMoisture;

  const submit = async () => {
    if (!crop || !stage || !soilColor || !soilMoisture || !hasDisease || !landOk || !ageOk) {
      return;
    }
    setAiError(null);
    try {
      const data = await recommend({
        cropSlug: crop,
        growthStage: stage,
        soilColor,
        soilMoisture,
        landSizeBigha: landUnit === "acre" ? landNum * BIGHA_PER_ACRE : landNum,
        cropAgeDays: Math.round(ageNum),
        hasDisease,
        ...(linkedDiagnosis
          ? linkedDiagnosis.sourceId
            ? { diagnosisId: linkedDiagnosis.sourceId }
            : {
                diseaseNameBn: linkedDiagnosis.diseaseNameBn,
                diseaseSeverity: linkedDiagnosis.severity,
              }
          : {}),
      }).unwrap();
      setAdvice(data);
      setShowResult(true);
    } catch (err) {
      setShowResult(false);
      setAiError(
        userFacingError(err, "generic", "সার সুপারিশ করা যায়নি। আবার চেষ্টা করুন।"),
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-card px-5 py-4">
        <AppText variant="title">সার সুপারিশ</AppText>
        <AppText variant="caption" className="mt-1">
          জমির পরিমাণ, ফসলের বয়স ও রোগের তথ্য দিয়ে মাত্রা ঠিক করুন
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-5 pb-16"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            ফসলের ধরন
          </AppText>
          <IconPickerRow
            options={CROP_OPTIONS.map((c) => ({
              id: c.id,
              label: c.label,
              icon: <Ionicons name={c.icon} size={22} color={colors.primary} />,
            }))}
            value={crop}
            onChange={(id) => setCrop(id as CropType)}
          />
        </View>

        <LandSizeInput
          value={landSize}
          onChangeText={setLandSize}
          unit={landUnit}
          onUnitChange={setLandUnit}
        />

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            ফসল কত দিনের? (রোপণ/বোনার পর)
          </AppText>
          <ChipRow
            options={AGE_PRESETS.map((d) => ({ id: d, label: `${toBnDigits(d)} দিন` }))}
            value={ageOk ? ageNum : null}
            onChange={(d) => setCropAgeDays(toBnDigits(d))}
          />
          <TextInput
            value={cropAgeDays}
            onChangeText={setCropAgeDays}
            keyboardType="number-pad"
            placeholder="অথবা লিখুন, যেমন: ৩৮"
            placeholderTextColor={colors.muted}
            accessibilityLabel="ফসলের বয়স, দিন"
            className="min-h-touch-lg rounded-2xl bg-card px-4 font-bengali-medium text-body-lg text-ink"
          />
        </View>

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            বৃদ্ধির ধাপ
          </AppText>
          {suggestedStage && !stageTouched ? (
            <AppText variant="caption" className="text-primary">
              বয়স দেখে ধাপ বেছে দেওয়া হয়েছে — ঠিক না হলে বদলে দিন।
            </AppText>
          ) : null}
          <IconPickerRow
            options={STAGE_OPTIONS.map((s) => ({
              id: s.id,
              label: s.label,
              icon: <Ionicons name={s.icon} size={22} color={colors.primary} />,
            }))}
            value={stage}
            onChange={(id) => {
              setStageTouched(true);
              setStage(id as GrowthStage);
            }}
          />
        </View>

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            ফসলে কোনো রোগ আছে?
          </AppText>
          <IconPickerRow
            options={DISEASE_OPTIONS.map((d) => ({
              id: d.id,
              label: d.label,
              icon: <Ionicons name={d.icon} size={22} color={colors.primary} />,
            }))}
            value={hasDisease}
            onChange={(id) => setHasDisease(id as DiseaseStatus)}
          />

          {hasDisease === "yes" ? (
            latestDiagnosis ? (
              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <View className="flex-1">
                    <AppText variant="caption" className="text-muted">
                      আপনার সর্বশেষ স্ক্যান
                    </AppText>
                    <AppText variant="body" className="font-bengali-bold text-ink">
                      {latestDiagnosis.diseaseNameBn}
                    </AppText>
                    <AppText variant="caption">{latestDiagnosis.dateBn}</AppText>
                  </View>
                </View>
                <ChipRow
                  options={[
                    { id: "linked", label: "এই রোগটিই" },
                    { id: "other", label: "অন্য রোগ" },
                  ]}
                  value={useLatestDiagnosis ? "linked" : "other"}
                  onChange={(id) => setUseLatestDiagnosis(id === "linked")}
                />
              </View>
            ) : (
              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <AppText variant="body" className="text-ink">
                  সাম্প্রতিক কোনো স্ক্যান পাওয়া যায়নি। রোগটি নিশ্চিত হতে পাতার ছবি
                  স্ক্যান করতে পারেন।
                </AppText>
                <SecondaryButton
                  label="পাতা স্ক্যান করুন"
                  onPress={() => router.push("/(root)/(tabs)/scan")}
                  icon={<Ionicons name="scan-outline" size={20} color={colors.ink} />}
                />
              </View>
            )
          ) : null}
        </View>

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            মাটির রং
          </AppText>
          <IconPickerRow
            options={SOIL_COLOR_OPTIONS.map((s) => ({
              id: s.id,
              label: s.label,
              icon: (
                <View
                  style={{
                    height: 22,
                    width: 22,
                    borderRadius: 11,
                    backgroundColor: s.swatch,
                  }}
                />
              ),
            }))}
            value={soilColor}
            onChange={(id) => setSoilColor(id as SoilColor)}
          />
        </View>

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            মাটির আর্দ্রতা
          </AppText>
          <IconPickerRow
            options={MOISTURE_OPTIONS.map((m) => ({
              id: m.id,
              label: m.label,
              icon: <Ionicons name={m.icon} size={22} color={colors.primary} />,
            }))}
            value={soilMoisture}
            onChange={(id) => setSoilMoisture(id as SoilMoisture)}
          />
        </View>

        <PrimaryButton
          label="সুপারিশ দেখুন"
          onPress={submit}
          disabled={!canSubmit}
          loading={isLoading}
          icon={<Ionicons name="flask-outline" size={20} color={colors.white} />}
        />

        {aiError ? (
          <RetryCard message={aiError} onRetry={() => setAiError(null)} />
        ) : null}

        {showResult && advice ? (
          <StructuredCard
            title={advice.fertilizerNameBn}
            icon={<Ionicons name="flask" size={22} color={colors.primary} />}
            footer={
              <ListenButton
                label="সুপারিশ শুনুন"
                textBn={[
                  advice.fertilizerNameBn,
                  advice.dosagePerBigha,
                  advice.applicationMethodBn,
                  advice.timingBn,
                ].join("। ")}
              />
            }
          >
            <View className="gap-4">
              <View>
                <AppText variant="caption">মাত্রা</AppText>
                <AppText variant="body" className="mt-0.5 text-ink">
                  {advice.dosagePerBigha}
                </AppText>
              </View>
              <View>
                <AppText variant="caption">প্রয়োগ পদ্ধতি</AppText>
                <AppText variant="body" className="mt-0.5 text-ink">
                  {advice.applicationMethodBn}
                </AppText>
              </View>
              <View>
                <AppText variant="caption">সময়</AppText>
                <AppText variant="body" className="mt-0.5 text-ink">
                  {advice.timingBn}
                </AppText>
              </View>

              {advice.warningBn ? (
                <View className="flex-row items-start gap-3 rounded-2xl bg-severity-medium-bg px-4 py-3">
                  <Ionicons name="warning" size={20} color="#B54708" />
                  <AppText variant="body" className="flex-1 leading-6 text-ink">
                    {advice.warningBn}
                  </AppText>
                </View>
              ) : null}
            </View>
          </StructuredCard>
        ) : null}

        {showResult && advice?.reasonBn ? (
          <View className="flex-row items-start gap-3 rounded-2xl bg-secondary px-4 py-3">
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <View className="flex-1">
              <AppText variant="caption" className="font-bengali-bold text-primary">
                কেন এই সুপারিশ
              </AppText>
              <AppText variant="body" className="mt-0.5 leading-6 text-ink">
                {advice.reasonBn}
              </AppText>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
