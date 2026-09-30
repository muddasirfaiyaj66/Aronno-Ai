import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  ForecastTimelineCard,
  ListenButton,
  PrimaryButton,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { useColors } from "@/context/theme";
import { formatTakaBn } from "@/utils/number";
import type { AdvisedCrop, FarmAdvice, WantedVerdict } from "@/types/planning";

const toBn = (n: number) =>
  new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 }).format(n);

const VERDICT: Record<
  WantedVerdict,
  { label: string; icon: keyof typeof Ionicons.glyphMap; box: string; text: string }
> = {
  good: {
    label: "করা যাবে",
    icon: "checkmark-circle",
    box: "bg-primary/10",
    text: "text-primary",
  },
  risky: {
    label: "ঝুঁকি আছে",
    icon: "alert-circle",
    box: "bg-harvest-soft",
    text: "text-harvest",
  },
  not_now: {
    label: "এখন নয়",
    icon: "close-circle",
    box: "bg-danger-soft",
    text: "text-danger",
  },
};

export function FarmAdviceResult({
  advice,
  landLabel,
  onEdit,
  onRefresh,
  refreshing,
}: {
  advice: FarmAdvice;
  landLabel?: string;
  onEdit: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const c = useColors();
  const best = advice.topCrops[0];

  return (
    <View className="gap-5">
      {/* Hero */}
      {best ? (
        <LinearGradient
          colors={["#0F766E", "#115E59"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 28, padding: 20, gap: 14 }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="location" size={16} color="#A7F3D0" />
            <AppText variant="caption" className="text-white/80">
              {advice.locationBn}
              {landLabel ? ` · ${landLabel}` : ""}
            </AppText>
          </View>
          <View className="flex-row items-center gap-4">
            <ScoreRing score={best.score} />
            <View className="flex-1 gap-1">
              <AppText variant="caption" className="text-white/80">
                আগামী ৬ মাসে আপনার জন্য সেরা ফসল
              </AppText>
              <AppText variant="title" className="text-white">
                {best.nameBn}
              </AppText>
              <AppText variant="caption" className="text-white/90">
                বপন: {best.sowBn} · কাটা: {best.harvestBn}
              </AppText>
            </View>
          </View>
          <AppText variant="body" className="leading-7 text-white">
            {advice.summaryBn}
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            <Tag
              icon="cloud-outline"
              label={
                advice.outlookSource === "seasonal"
                  ? "৬ মাসের মৌসুমি পূর্বাভাস"
                  : "দীর্ঘমেয়াদি আবহাওয়ার গড়"
              }
            />
            <Tag
              icon={advice.generatedBy === "ai" ? "sparkles" : "calculator-outline"}
              label={advice.generatedBy === "ai" ? "AI বিশ্লেষণ" : "নিয়মভিত্তিক হিসাব"}
            />
          </View>
        </LinearGradient>
      ) : null}

      <ListenButton label="পরামর্শ শুনুন" textBn={advice.summaryBn} />

      {/* Weather strip */}
      {advice.months.length ? (
        <ForecastTimelineCard
          title="আপনার এলাকার ৬ মাসের আবহাওয়া"
          subtitle="প্রতি মাসের তাপমাত্রা ও বৃষ্টি"
          months={advice.months.map((m, i) => ({
            id: `${m.month}-${i}`,
            monthLabel: m.month,
            weatherIcon: m.weatherIcon,
            cropLabel: m.recommendedCropBn,
            tempC: m.tempC,
            precipMm: m.precipMm,
          }))}
        />
      ) : null}

      {/* Ranked crops */}
      <View className="gap-3">
        <SectionTitle icon="podium-outline" title="সেরা ফসলের তালিকা" />
        {advice.topCrops.map((crop, i) => (
          <CropCard key={`${crop.nameBn}-${i}`} crop={crop} rank={i + 1} />
        ))}
      </View>

      {/* The farmer's own wishes */}
      {advice.wantedCheck.length ? (
        <StructuredCard
          title="আপনার পছন্দের ফসল"
          icon={<Ionicons name="heart-outline" size={22} color={c.primary} />}
        >
          <View className="gap-2">
            {advice.wantedCheck.map((w) => {
              const v = VERDICT[w.verdict];
              return (
                <View key={w.nameBn} className={`gap-1 rounded-2xl px-4 py-3 ${v.box}`}>
                  <View className="flex-row items-center justify-between gap-2">
                    <AppText variant="body" className="font-bengali-bold text-ink">
                      {w.nameBn}
                    </AppText>
                    <View className="flex-row items-center gap-1">
                      <Ionicons
                        name={v.icon}
                        size={18}
                        color={
                          w.verdict === "good"
                            ? c.primary
                            : w.verdict === "risky"
                              ? c.harvest
                              : c.danger
                        }
                      />
                      <AppText variant="caption" className={`font-bengali-bold ${v.text}`}>
                        {v.label}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="caption" className="text-ink">
                    {w.reasonBn}
                  </AppText>
                </View>
              );
            })}
          </View>
        </StructuredCard>
      ) : null}

      {/* 6-month work calendar */}
      {advice.timeline.length ? (
        <StructuredCard
          title="৬ মাসের কাজের ক্যালেন্ডার"
          icon={<Ionicons name="calendar-outline" size={22} color={c.primary} />}
        >
          <View>
            {advice.timeline.map((t, i) => (
              <View key={`${t.monthBn}-${i}`} className="flex-row gap-3">
                <View className="items-center">
                  <View className="h-3.5 w-3.5 rounded-full bg-primary" />
                  {i < advice.timeline.length - 1 ? (
                    <View className="w-0.5 flex-1 bg-primary/30" />
                  ) : null}
                </View>
                <View className="flex-1 gap-0.5 pb-4">
                  <AppText variant="body" className="-mt-1 font-bengali-bold text-primary">
                    {t.monthBn}
                  </AppText>
                  <AppText variant="body" className="text-ink">
                    {t.activityBn}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </StructuredCard>
      ) : null}

      <AppText variant="caption" className="px-1 text-muted">
        এটি আবহাওয়ার পূর্বাভাস ও আপনার দেওয়া তথ্যের ভিত্তিতে পরামর্শ। বীজ কেনার আগে স্থানীয়
        কৃষি অফিসের সাথেও কথা বলুন।
      </AppText>

      <View className="flex-row gap-3">
        <SecondaryButton
          label="তথ্য বদলান"
          onPress={onEdit}
          className="flex-1"
          icon={<Ionicons name="create-outline" size={20} color={c.ink} />}
        />
        <PrimaryButton
          label="আবার দেখুন"
          onPress={onRefresh}
          loading={refreshing}
          disabled={refreshing}
          className="flex-1"
          icon={<Ionicons name="refresh" size={20} color="#fff" />}
        />
      </View>
    </View>
  );
}

function CropCard({ crop, rank }: { crop: AdvisedCrop; rank: number }) {
  const c = useColors();
  return (
    <View className="gap-3 rounded-3xl bg-card p-4">
      <View className="flex-row items-center gap-3">
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${
            rank === 1 ? "bg-primary" : "bg-primary/10"
          }`}
        >
          <AppText
            variant="bodyLg"
            className={`font-bengali-bold ${rank === 1 ? "text-white" : "text-primary"}`}
          >
            {toBn(rank)}
          </AppText>
        </View>
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <AppText variant="subtitle">{crop.nameBn}</AppText>
            {crop.wanted ? (
              <View className="rounded-full bg-harvest-soft px-2 py-0.5">
                <AppText variant="caption" className="font-bengali-bold text-harvest">
                  আপনার পছন্দ
                </AppText>
              </View>
            ) : null}
          </View>
          <View className="mt-1.5 flex-row items-center gap-2">
            <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <View
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.max(5, Math.min(100, crop.score))}%` }}
              />
            </View>
            <AppText variant="caption" className="font-bengali-bold text-primary">
              {toBn(crop.score)}%
            </AppText>
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Reason icon="partly-sunny-outline" color={c.primary} text={crop.fitBn} />
        <Reason icon="sync-outline" color={c.primary} text={crop.rotationBn} />
        <Reason icon="warning-outline" color={c.harvest} text={crop.riskBn} />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Pill icon="leaf-outline" label={`বপন: ${crop.sowBn}`} />
        <Pill icon="basket-outline" label={`কাটা: ${crop.harvestBn}`} />
        {crop.cost ? (
          <Pill
            icon="cash-outline"
            label={`আনুমানিক খরচ ৳ ${formatTakaBn(crop.cost.totalBdt)}`}
          />
        ) : null}
      </View>
    </View>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 5,
        borderColor: "#5EEAD4",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.12)",
      }}
    >
      <AppText variant="subtitle" className="text-white">
        {toBn(score)}%
      </AppText>
    </View>
  );
}

function Tag({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-3 py-1">
      <Ionicons name={icon} size={14} color="#fff" />
      <AppText variant="caption" className="text-white">
        {label}
      </AppText>
    </View>
  );
}

function Reason({
  icon,
  color,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
}) {
  return (
    <View className="flex-row gap-2">
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 3 }} />
      <AppText variant="body" className="flex-1 leading-7 text-ink">
        {text}
      </AppText>
    </View>
  );
}

function Pill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const c = useColors();
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-neutral px-3 py-1.5">
      <Ionicons name={icon} size={14} color={c.primary} />
      <AppText variant="caption" className="text-ink">
        {label}
      </AppText>
    </View>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  const c = useColors();
  return (
    <View className="flex-row items-center gap-2 px-1">
      <Ionicons name={icon} size={20} color={c.primary} />
      <AppText variant="bodyLg" className="font-bengali-bold text-ink">
        {title}
      </AppText>
    </View>
  );
}
