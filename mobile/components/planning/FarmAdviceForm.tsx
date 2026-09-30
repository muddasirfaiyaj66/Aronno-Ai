import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  LandSizeInput,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { useColors } from "@/context/theme";
import { parseNumberInput } from "@/utils/number";
import type { LandUnit } from "@/types/treatment";
import type { FarmGoal, LandType } from "@/types/planning";

/** Common Bangladeshi field crops the farmer can tap instead of typing. */
export const CROP_CHOICES = [
  "আমন ধান",
  "বোরো ধান",
  "আউশ ধান",
  "গম",
  "আলু",
  "পাট",
  "সরিষা",
  "মসুর ডাল",
  "ভুট্টা",
  "পেঁয়াজ",
  "টমেটো",
  "শীতের সবজি",
  "মরিচ",
  "আখ",
  "তরমুজ",
];

const LAND_TYPES: { id: LandType; label: string }[] = [
  { id: "high", label: "উঁচু" },
  { id: "medium", label: "মাঝারি" },
  { id: "low", label: "নিচু" },
];

const GOALS: { id: FarmGoal; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "profit", label: "বেশি লাভ", icon: "trending-up" },
  { id: "low_cost", label: "কম খরচ", icon: "wallet-outline" },
  { id: "food", label: "নিজের খাবার", icon: "restaurant-outline" },
  { id: "low_risk", label: "কম ঝুঁকি", icon: "shield-checkmark-outline" },
];

export type FarmDraft = {
  landSize: string;
  landUnit: LandUnit;
  landType?: LandType;
  pastCrops: { nameBn: string }[];
  wantedCrops: string[];
  goal?: FarmGoal;
};

export const EMPTY_DRAFT: FarmDraft = {
  landSize: "",
  landUnit: "bigha",
  pastCrops: [],
  wantedCrops: [],
};

const STEPS = [
  { title: "আপনার জমি", icon: "map-outline" },
  { title: "গত ১ বছরে কী চাষ করেছেন", icon: "time-outline" },
  { title: "সামনে কী চাষ করতে চান", icon: "leaf-outline" },
] as const;

export function FarmAdviceForm({
  draft,
  onChange,
  onSubmit,
  submitting,
}: {
  draft: FarmDraft;
  onChange: (next: FarmDraft) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const c = useColors();
  const [step, setStep] = useState(0);
  const landOk = parseNumberInput(draft.landSize) > 0;
  const set = (patch: Partial<FarmDraft>) => onChange({ ...draft, ...patch });

  const togglePast = (nameBn: string) =>
    set({
      pastCrops: draft.pastCrops.some((p) => p.nameBn === nameBn)
        ? draft.pastCrops.filter((p) => p.nameBn !== nameBn)
        : [...draft.pastCrops, { nameBn }].slice(0, 12),
    });
  const toggleWanted = (nameBn: string) =>
    set({
      wantedCrops: draft.wantedCrops.includes(nameBn)
        ? draft.wantedCrops.filter((w) => w !== nameBn)
        : [...draft.wantedCrops, nameBn].slice(0, 8),
    });

  return (
    <View className="gap-4 rounded-3xl bg-card p-5">
      {/* Progress */}
      <View className="gap-3">
        <View className="flex-row gap-2">
          {STEPS.map((s, i) => (
            <View
              key={s.title}
              className={`h-2 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-neutral-200"}`}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-3">
          {step > 0 ? (
            <Pressable
              onPress={() => setStep((s) => s - 1)}
              accessibilityRole="button"
              accessibilityLabel="আগের ধাপে যান"
              hitSlop={8}
              className="h-11 w-11 items-center justify-center rounded-full bg-neutral"
            >
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
          ) : null}
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <Ionicons name={STEPS[step].icon} size={22} color={c.primary} />
          </View>
          <View className="flex-1">
            <AppText variant="caption">ধাপ {["১", "২", "৩"][step]} / ৩</AppText>
            <AppText variant="subtitle">{STEPS[step].title}</AppText>
          </View>
        </View>
      </View>

      {step === 0 ? (
        <View className="gap-5">
          <LandSizeInput
            value={draft.landSize}
            onChangeText={(landSize) => set({ landSize })}
            unit={draft.landUnit}
            onUnitChange={(landUnit) => set({ landUnit })}
            label="কতটুকু জমিতে চাষ করবেন?"
          />
          <View className="gap-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              জমি কেমন? (ঐচ্ছিক)
            </AppText>
            <View className="flex-row flex-wrap gap-2">
              {LAND_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={`${t.label} জমি`}
                  selected={draft.landType === t.id}
                  onPress={() =>
                    set({ landType: draft.landType === t.id ? undefined : t.id })
                  }
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View className="gap-4">
          <AppText variant="caption">
            যেসব ফসল করেছেন সেগুলো বাছাই করুন। এতে একই ফসল বারবার না করে মাটির জন্য ভালো
            পালাক্রম বলা যাবে।
          </AppText>
          <CropPicker
            selected={draft.pastCrops.map((p) => p.nameBn)}
            onToggle={togglePast}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-5">
          <View className="gap-3">
            <AppText variant="caption">
              যে ফসল করতে চান বাছাই করুন — আবহাওয়ায় মানাবে কিনা আমরা জানিয়ে দেব।
            </AppText>
            <CropPicker selected={draft.wantedCrops} onToggle={toggleWanted} />
          </View>
          <View className="gap-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              আপনার লক্ষ্য কী? (ঐচ্ছিক)
            </AppText>
            <View className="flex-row flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip
                  key={g.id}
                  label={g.label}
                  icon={g.icon}
                  selected={draft.goal === g.id}
                  onPress={() => set({ goal: draft.goal === g.id ? undefined : g.id })}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* Navigation */}
      <View className="flex-row gap-3 pt-1">
        {step > 0 ? (
          <SecondaryButton
            label="পেছনে"
            onPress={() => setStep((s) => s - 1)}
            className="flex-1"
          />
        ) : null}
        {step < 2 ? (
          <PrimaryButton
            label="পরের ধাপ"
            disabled={step === 0 && !landOk}
            onPress={() => setStep((s) => s + 1)}
            className="flex-1"
            icon={<Ionicons name="arrow-forward" size={20} color="#fff" />}
          />
        ) : (
          <PrimaryButton
            label="পরামর্শ দেখুন"
            loading={submitting}
            disabled={!landOk || submitting}
            onPress={onSubmit}
            className="flex-1"
            icon={<Ionicons name="sparkles" size={20} color="#fff" />}
          />
        )}
      </View>
      {step === 0 && !landOk && draft.landSize.length > 0 ? (
        <AppText variant="caption" className="text-danger">
          জমির পরিমাণ সংখ্যায় লিখুন, যেমন ২ বা ১.৫
        </AppText>
      ) : null}
    </View>
  );
}

/** Crop chips plus a field to add a crop that isn't listed. */
function CropPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (nameBn: string) => void;
}) {
  const c = useColors();
  const [custom, setCustom] = useState("");
  const extra = selected.filter((s) => !CROP_CHOICES.includes(s));
  const add = () => {
    const name = custom.trim();
    if (name.length >= 2 && !selected.includes(name)) onToggle(name);
    setCustom("");
  };

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {[...CROP_CHOICES, ...extra].map((name) => (
          <Chip
            key={name}
            label={name}
            selected={selected.includes(name)}
            onPress={() => onToggle(name)}
          />
        ))}
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={add}
          placeholder="অন্য ফসল লিখুন"
          placeholderTextColor={c.muted}
          maxLength={30}
          returnKeyType="done"
          accessibilityLabel="অন্য ফসলের নাম"
          className="min-h-touch flex-1 rounded-2xl bg-neutral px-4 font-bengali text-body text-ink"
        />
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="ফসল যোগ করুন"
          className="min-h-touch items-center justify-center rounded-2xl bg-primary px-4"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  icon,
  small,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`flex-row items-center gap-1.5 rounded-full border ${
        small ? "px-3 py-1.5" : "min-h-touch px-4"
      } ${selected ? "border-primary bg-primary" : "border-border bg-card"}`}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color="#fff" />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={c.primary} />
      ) : null}
      <AppText
        variant={small ? "caption" : "body"}
        className={selected ? "font-bengali-bold text-white" : "text-ink"}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
