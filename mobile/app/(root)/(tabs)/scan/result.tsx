import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
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
import { useSpeakMutation } from "@/services/api";
import type { SeverityLevel } from "@/components/ui/SeverityBadge";

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
      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <AppText variant="bodyLg" className="font-bengali-bold text-primary">
          {Math.round(clamped)}%
        </AppText>
      </View>
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
  }>();
  const [enlarged, setEnlarged] = useState(false);
  const [speak] = useSpeakMutation();

  const confidence = Number(params.confidence) || 0;
  const imageUrl = params.imageUrl ?? "";
  const severity: SeverityLevel = params.severity ?? "medium";
  const readOnly = params.readOnly === "1";

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="রোগের ফল"
        subtitle="শুনুন, তারপর চিকিৎসা দেখুন"
      />

      <View className="flex-1 px-5 py-5">
        <StructuredCard
          title={params.diseaseNameBn}
          icon={<Ionicons name="leaf" size={22} color={colors.primary} />}
          footer={
            <View className="gap-3">
              <ListenButton
                onPlay={() => {
                  speak({
                    textBn: `${params.diseaseNameBn}. ${params.diseaseNameEn}.`,
                  });
                }}
                onPause={() => {}}
              />
              {readOnly ? (
                <SecondaryButton
                  label="ফিরে যান"
                  onPress={() => router.back()}
                  icon={
                    <Ionicons name="arrow-back" size={20} color={colors.ink} />
                  }
                />
              ) : (
                <PrimaryButton
                  label="চিকিৎসা দেখুন"
                  onPress={() =>
                    router.push({
                      pathname: "/(root)/(tabs)/scan/treatment-plan",
                      params: {
                        diagnosisId: params.id,
                        diseaseNameBn: params.diseaseNameBn,
                        severity,
                      },
                    })
                  }
                  icon={
                    <Ionicons
                      name="medkit-outline"
                      size={20}
                      color={colors.white}
                    />
                  }
                />
              )}
            </View>
          }
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
                  <Ionicons name="image-outline" size={36} color={colors.primary} />
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
      </View>

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
