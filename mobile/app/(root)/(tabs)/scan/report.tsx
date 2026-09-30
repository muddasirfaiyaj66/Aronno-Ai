import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  AIGeneratingShimmer,
  AppText,
  ListenButton,
  PrimaryButton,
  RetryCard,
  ScreenHeader,
  SeverityBadge,
  StructuredCard,
} from "@/components/ui";
import { WeatherAdvisoryCard } from "@/components/treatment/WeatherAdvisoryCard";
import { colors } from "@/constants/theme";
import type { SeverityLevel } from "@/types/diagnosis";
import { reportHtml, saveAndSharePdf } from "@/lib/reportPdf";
import { useAppSelector } from "@/store";
import {
  useCreateReportMutation,
  useDownloadReportPdfMutation,
  useGetTreatmentPlanQuery,
} from "@/services/api";

export default function ReportPreviewScreen() {
  const params = useLocalSearchParams<{
    diseaseNameBn?: string;
    diseaseNameEn?: string;
    confidence?: string;
    severity?: SeverityLevel;
    diagnosisId?: string;
  }>();
  const farmerName = useAppSelector((s) => s.auth.user?.displayName);
  const { data: plan } = useGetTreatmentPlanQuery(params.diagnosisId ?? "", {
    skip: !params.diagnosisId,
  });
  const [createReport] = useCreateReportMutation();
  const [downloadPdf] = useDownloadReportPdfMutation();
  const [reportId, setReportId] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("bn-BD", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    if (!toastVisible) return;
    const id = setTimeout(() => setToastVisible(false), 2400);
    return () => clearTimeout(id);
  }, [toastVisible]);

  const handleDownload = async () => {
    if (!params.diagnosisId || !plan) return;
    setDownloadError(false);
    setDownloading(true);
    try {
      const created =
        reportId ??
        (await createReport({ diagnosisId: params.diagnosisId }).unwrap()).id;
      setReportId(created);

      let pdfBase64: string | undefined;
      try {
        const pdf = await downloadPdf(created).unwrap();
        pdfBase64 = pdf.pdfBase64;
      } catch {
        // local HTML PDF still works
      }

      await saveAndSharePdf({
        pdfBase64,
        filename: `aronno-report-${created.slice(-8)}.pdf`,
        htmlFallback: reportHtml({
          farmerName: farmerName ?? undefined,
          dateLabel,
          diseaseNameBn: params.diseaseNameBn ?? plan.diseaseNameBn,
          diseaseNameEn: params.diseaseNameEn,
          confidence: params.confidence,
          severity: params.severity,
          plan,
        }),
      });
      setToastVisible(true);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  if (!plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral px-6">
        <AIGeneratingShimmer
          label="রিপোর্ট তৈরি হচ্ছে"
          lines={4}
          className="w-full"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="রিপোর্ট প্রিভিউ"
        subtitle={`${plan.cropNameBn} · ${dateLabel}`}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        <StructuredCard
          title="রোগ নির্ণয়"
          icon={<Ionicons name="leaf" size={22} color={colors.primary} />}
        >
          <View className="gap-2">
            <AppText
              variant="bodyLg"
              className="font-bengali-bold text-primary"
            >
              {params.diseaseNameBn ?? plan.diseaseNameBn}
            </AppText>
            {params.diseaseNameEn ? (
              <AppText variant="caption" className="text-muted">
                {params.diseaseNameEn}
              </AppText>
            ) : null}
            <View className="mt-1 flex-row items-center justify-between">
              <SeverityBadge level={params.severity ?? "medium"} />
              {params.confidence ? (
                <AppText variant="body" className="font-bengali-bold text-ink">
                  নির্ভুলতা {params.confidence}%
                </AppText>
              ) : null}
            </View>
          </View>
        </StructuredCard>

        <StructuredCard
          title="চিকিৎসা"
          icon={<Ionicons name="medkit" size={22} color={colors.primary} />}
        >
          <View className="gap-3">
            <View>
              <AppText variant="caption">কীটনাশক</AppText>
              <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                {plan.pesticideNameBn}
              </AppText>
              <AppText variant="body" className="text-muted">
                মাত্রা: {plan.dosagePerBigha}
              </AppText>
            </View>
            <View className="flex-row items-center gap-2 self-start rounded-full bg-secondary px-4 py-2">
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.primary}
              />
              <AppText
                variant="caption"
                className="font-bengali-bold text-primary"
              >
                {plan.followUpLabelBn}
              </AppText>
            </View>
          </View>
        </StructuredCard>

        <View className="gap-2">
          <AppText variant="body" className="font-bengali-bold text-ink">
            আবহাওয়া পরামর্শ
          </AppText>
          <WeatherAdvisoryCard
            level={plan.weatherAdvisory.level}
            reasonBn={plan.weatherAdvisory.reasonBn}
          />
        </View>
      </ScrollView>

      <View className="gap-3 border-t border-neutral-200 bg-card px-5 py-4">
        <ListenButton
          label="পুরো রিপোর্ট শুনুন"
          textBn={`${plan.diseaseNameBn}. ${plan.pesticideNameBn}. ${plan.weatherAdvisory.reasonBn}`}
        />

        {downloading ? (
          <AIGeneratingShimmer label="PDF তৈরি হচ্ছে…" lines={2} />
        ) : downloadError ? (
          <RetryCard
            message="PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।"
            onRetry={handleDownload}
          />
        ) : (
          <PrimaryButton
            label="PDF ডাউনলোড করুন"
            onPress={handleDownload}
            icon={
              <Ionicons
                name="download-outline"
                size={20}
                color={colors.white}
              />
            }
          />
        )}
      </View>

      {toastVisible ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(220)}
          className="absolute bottom-32 left-5 right-5 items-center rounded-2xl bg-neutral-900 px-4 py-3"
        >
          <AppText variant="caption" className="text-center text-white">
            রিপোর্ট তৈরি হয়েছে — সংরক্ষণ বা শেয়ার করুন।
          </AppText>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}
