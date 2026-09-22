import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  FieldInput,
  IconPickerRow,
  ListenButton,
  PrimaryButton,
  RetryCard,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import type { CropType } from "@/types/treatment";
import type { FertilizerAdvice, GrowthStage, SoilColor, SoilMoisture } from "@/types/fertilizer";
import {
  useRecommendFertilizerMutation,
} from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";

const CROP_OPTIONS: {
  id: CropType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "rice", label: "ধান", icon: "leaf-outline" },
  { id: "potato", label: "আলু", icon: "ellipse-outline" },
  { id: "tomato", label: "টমেটো", icon: "nutrition-outline" },
  { id: "vegetable", label: "সবজি", icon: "basket-outline" },
];

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
  id: "yes" | "no" | "unsure";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "yes", label: "আছে", icon: "warning-outline" },
  { id: "no", label: "নেই", icon: "checkmark-circle-outline" },
  { id: "unsure", label: "জানি না", icon: "help-circle-outline" },
];

export default function FertilizerRecommendationScreen() {
  const [crop, setCrop] = useState<CropType | null>(null);
  const [landSizeBigha, setLandSizeBigha] = useState("");
  const [cropAgeDays, setCropAgeDays] = useState("");
  const [hasDisease, setHasDisease] = useState<"yes" | "no" | "unsure" | null>(
    null,
  );
  const [stage, setStage] = useState<GrowthStage | null>(null);
  const [soilColor, setSoilColor] = useState<SoilColor | null>(null);
  const [soilMoisture, setSoilMoisture] = useState<SoilMoisture | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [advice, setAdvice] = useState<FertilizerAdvice | null>(null);
  const [recommend, { isLoading }] = useRecommendFertilizerMutation();
  const [aiError, setAiError] = useState<string | null>(null);

  const landNum = Number(landSizeBigha.replace(/,/g, "."));
  const ageNum = Number(cropAgeDays);
  const landOk = Number.isFinite(landNum) && landNum > 0;
  const ageOk = Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 400;

  const canSubmit =
    !!crop &&
    landOk &&
    ageOk &&
    !!hasDisease &&
    !!stage &&
    !!soilColor &&
    !!soilMoisture;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">সার সুপারিশ</AppText>
        <AppText variant="caption" className="mt-1">
          জমির পরিমাণ, ফসলের বয়স ও রোগের তথ্য দিয়ে মাত্রা ঠিক করুন
        </AppText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-5"
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

        <FieldInput
          label="জমির পরিমাণ (বিঘা)"
          value={landSizeBigha}
          onChangeText={setLandSizeBigha}
          placeholder="যেমন: ২ অথবা ১.৫"
          keyboardType="decimal-pad"
        />

        <FieldInput
          label="ফসল কত দিনের"
          value={cropAgeDays}
          onChangeText={setCropAgeDays}
          placeholder="যেমন: ৩০"
          keyboardType="number-pad"
        />

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
            onChange={(id) => setHasDisease(id as "yes" | "no" | "unsure")}
          />
        </View>

        <View className="gap-3">
          <AppText variant="body" className="font-bengali-bold text-ink">
            বৃদ্ধির ধাপ
          </AppText>
          <IconPickerRow
            options={STAGE_OPTIONS.map((s) => ({
              id: s.id,
              label: s.label,
              icon: <Ionicons name={s.icon} size={22} color={colors.primary} />,
            }))}
            value={stage}
            onChange={(id) => setStage(id as GrowthStage)}
          />
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
          onPress={async () => {
            if (
              !crop ||
              !stage ||
              !soilColor ||
              !soilMoisture ||
              !hasDisease ||
              !landOk ||
              !ageOk
            ) {
              return;
            }
            setAiError(null);
            try {
              const data = await recommend({
                cropSlug: crop,
                growthStage: stage,
                soilColor,
                soilMoisture,
                landSizeBigha: landNum,
                cropAgeDays: Math.round(ageNum),
                hasDisease,
              }).unwrap();
              setAdvice(data);
              setShowResult(true);
            } catch (err) {
              setShowResult(false);
              setAiError(
                userFacingError(err, "generic", "সার সুপারিশ করা যায়নি। আবার চেষ্টা করুন।"),
              );
            }
          }}
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
      </ScrollView>
    </SafeAreaView>
  );
}
