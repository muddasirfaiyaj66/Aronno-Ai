import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import {
  AppText,
  ListenButton,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  SeverityBadge,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import type { SeverityLevel } from "@/components/ui/SeverityBadge";
import { adviceFromKb } from "@/lib/offlineNlu/offlineTreatment";

function ConfidenceRing({ percent }: { percent: number }) {
  const size = 88;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.secondary}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        <AppText variant="bodyLg" className="font-bengali-bold text-primary">
          {Math.round(clamped)}%
        </AppText>
      </View>
    </View>
  );
}

function AdviceBlock({
  title,
  icon,
  body,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  body: string;
}) {
  return (
    <View className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <View className="mb-1.5 flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color={colors.primary} />
        <AppText variant="body" className="font-bengali-bold">
          {title}
        </AppText>
      </View>
      <AppText variant="body" className="leading-6 text-ink">
        {body}
      </AppText>
    </View>
  );
}

export default function DiagnosisResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    diseaseNameBn: string;
    diseaseNameEn: string;
    confidence: string;
    severity: SeverityLevel;
    imageUrl?: string;
    readOnly?: string;
    id?: string;
    verifiedBn?: string;
  }>();
  const [enlarged, setEnlarged] = useState(false);

  const confidence = Number(params.confidence) || 0;
  const imageUrl = params.imageUrl ?? "";
  const severity: SeverityLevel = params.severity ?? "medium";
  const readOnly = params.readOnly === "1";

  const advice = useMemo(
    () => adviceFromKb(params.diseaseNameBn, params.diseaseNameEn),
    [params.diseaseNameBn, params.diseaseNameEn],
  );

  const listenBn =
    advice?.listenBn ??
    `${params.diseaseNameBn ?? ""}. ${params.diseaseNameEn ?? ""}.`;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="রোগের ফল"
        subtitle={
          advice
            ? "লক্ষণ, চিকিৎসা ও প্রতিরোধ দেখুন"
            : "শুনুন, তারপর চিকিৎসা দেখুন"
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <StructuredCard
          title={params.diseaseNameBn}
          icon={<Ionicons name="leaf" size={22} color={colors.primary} />}
        >
          <View className="items-center gap-4">
            <Pressable
              onPress={() => (imageUrl ? setEnlarged(true) : undefined)}
              accessibilityRole="button"
              accessibilityLabel="ছবি বড় করে দেখুন"
              className="w-full"
            >
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={{ height: 160, width: "100%", borderRadius: 20 }}
                  resizeMode="cover"
                />
              ) : (
                <View className="h-40 w-full items-center justify-center rounded-2xl bg-secondary">
                  <Ionicons
                    name="image-outline"
                    size={36}
                    color={colors.primary}
                  />
                </View>
              )}
            </Pressable>

            <AppText variant="caption" className="text-center text-muted">
              {params.diseaseNameEn}
            </AppText>

            <View className="w-full flex-row items-center justify-between">
              <SeverityBadge level={severity} />
              <ConfidenceRing percent={confidence} />
            </View>
          </View>
        </StructuredCard>

        {params.verifiedBn ? (
          <View className="rounded-2xl bg-harvest-soft px-4 py-3">
            <AppText variant="caption" className="mb-1 font-bengali-bold text-ink">
              আরণ্যর নোট
            </AppText>
            <AppText variant="body">{params.verifiedBn}</AppText>
          </View>
        ) : null}

        {advice ? (
          <View className="gap-3">
            <AppText variant="bodyLg" className="font-bengali-bold">
              পরামর্শ
            </AppText>
            <AdviceBlock
              title="লক্ষণ"
              icon="eye-outline"
              body={advice.symptomsBn}
            />
            <AdviceBlock
              title="চিকিৎসা"
              icon="medkit-outline"
              body={advice.treatmentBn}
            />
            <AdviceBlock
              title="প্রতিরোধ"
              icon="shield-checkmark-outline"
              body={advice.preventionBn}
            />
          </View>
        ) : (
          <View className="rounded-2xl border border-border bg-card px-4 py-3">
            <AppText variant="body" className="text-muted">
              এই রোগের বিস্তারিত পরামর্শ স্থানীয় জ্ঞানভাণ্ডারে নেই। নিচ থেকে
              চিকিৎসা পরিকল্পনা দেখুন বা কৃষি অফিসে যোগাযোগ করুন।
            </AppText>
          </View>
        )}

        <ListenButton label="পরামর্শ শুনুন" textBn={listenBn} />

        <PrimaryButton
          label="চিকিৎসা পরিকল্পনা"
          onPress={() =>
            router.push({
              pathname: "/(root)/(tabs)/scan/treatment-plan",
              params: {
                diagnosisId: params.id ?? "",
                diseaseNameBn: params.diseaseNameBn,
                diseaseNameEn: params.diseaseNameEn,
                severity,
              },
            })
          }
          icon={
            <Ionicons name="medkit-outline" size={20} color={colors.white} />
          }
        />

        {readOnly ? (
          <SecondaryButton
            label="ফিরে যান"
            onPress={() => router.back()}
            icon={<Ionicons name="arrow-back" size={20} color={colors.ink} />}
          />
        ) : (
          <SecondaryButton
            label="স্ক্যানে ফিরে যান"
            onPress={() => router.replace("/(root)/(tabs)/scan")}
            icon={<Ionicons name="camera-outline" size={20} color={colors.ink} />}
          />
        )}
      </ScrollView>

      <Modal
        visible={enlarged}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlarged(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90"
          onPress={() => setEnlarged(false)}
          accessibilityRole="button"
          accessibilityLabel="বন্ধ করুন"
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ height: "80%", width: "100%" }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
