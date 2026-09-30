import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppText,
  FieldInput,
  FormSection,
  PrimaryButton,
  SecondaryButton,
  ScreenHeader,
} from "@/components/ui";
import { ConsultStatusChip } from "@/components/consult/ConsultStatusChip";
import { colors } from "@/constants/theme";
import { useAppSelector } from "@/store";
import { saveAndSharePdf } from "@/lib/reportPdf";
import {
  getApiError,
  useAcceptConsultMutation,
  useRingConsultMutation,
  useCancelConsultMutation,
  useConsultPdfMutation,
  useDeleteConsultMutation,
  useGetConsultQuery,
  useSaveConsultAdviceMutation,
} from "@/services/api";
import { CALL_URL } from "@/services/callApi";
import type { ConsultMedicine } from "@/types/consult";

const emptyMedicine = (): ConsultMedicine => ({ name: "", dose: "", howToApply: "" });

export default function ConsultDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultId = typeof id === "string" ? id : "";
  const router = useRouter();
  const me = useAppSelector((s) => s.auth.user);
  const { data, isError, error: loadError } = useGetConsultQuery(consultId, {
    skip: !consultId,
    pollingInterval: 4000,
  });
  const [accept, { isLoading: accepting }] = useAcceptConsultMutation();
  const [ring, { isLoading: ringing }] = useRingConsultMutation();
  const [cancel, { isLoading: cancelling }] = useCancelConsultMutation();
  const [saveAdvice, { isLoading: saving }] = useSaveConsultAdviceMutation();
  const [pdf, { isLoading: savingPdf }] = useConsultPdfMutation();
  const [removeConsult, { isLoading: deleting }] = useDeleteConsultMutation();
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [medicines, setMedicines] = useState<ConsultMedicine[]>([emptyMedicine()]);
  const [error, setError] = useState("");

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
        <ScreenHeader title="পরামর্শ" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          {isError ? (
            <AppText variant="body" className="text-center">
              {getApiError(loadError).message ?? "এই পরামর্শ আর আপনার তালিকায় নেই।"}
            </AppText>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const mine = data.specialist?.id === me?.id;
  const canWrite = mine && (data.status === "accepted" || data.status === "ended");
  const canAnswer =
    CALL_URL.length > 0 &&
    data.videoReady &&
    (data.status === "ringing" || data.status === "in_call") &&
    data.farmer.id === me?.id;
  const canCall =
    mine &&
    (data.status === "accepted" || data.status === "ringing" || data.status === "in_call");

  async function onCall() {
    setError("");
    try {
      const result = await ring(consultId).unwrap();
      if (result.videoReady === false) {
        setError("ভিডিও রুম খোলা যায়নি।");
        return;
      }
      router.push({
        pathname: "/(root)/consult/call",
        params: { consultId },
      } as never);
    } catch (err) {
      setError(getApiError(err).message ?? "কল শুরু করা যায়নি।");
    }
  }

  async function onAccept() {
    setError("");
    try {
      await accept(consultId).unwrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "গ্রহণ করা যায়নি।");
    }
  }

  async function onSave() {
    setError("");
    const cleaned = medicines.filter((item) => item.name && item.dose && item.howToApply);
    try {
      await saveAdvice({
        id: consultId,
        summaryBn: summary.trim(),
        steps: steps.trim(),
        medicines: cleaned,
      }).unwrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "পরামর্শ সেভ হয়নি।");
    }
  }

  async function onPdf() {
    const file = await pdf(consultId).unwrap();
    await saveAndSharePdf({
      pdfBase64: file.pdfBase64,
      filename: file.filename,
      htmlFallback: `<p>${data?.advice?.summaryBn ?? ""}</p>`,
    });
  }

  const liveCall = data.status === "ringing" || data.status === "in_call";
  const peerName = mine ? data.farmer.displayName : data.specialist?.displayName ?? "বিশেষজ্ঞ";

  function confirmDelete() {
    if (liveCall) {
      Alert.alert("এখন মুছা যাবে না", "কল শেষ হলে তারপর তালিকা থেকে মুছতে পারবেন।");
      return;
    }
    Alert.alert("মিটিং মুছবেন?", "এটি শুধু আপনার তালিকা থেকে সরবে। অপর পক্ষ এখনো দেখতে পাবেন।", [
      { text: "না", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          void removeConsult(consultId)
            .unwrap()
            .then(() => router.back())
            .catch((err: unknown) => {
              setError(getApiError(err).message ?? "মুছা যায়নি।");
            });
        },
      },
    ]);
  }

  function patchMedicine(index: number, patch: Partial<ConsultMedicine>) {
    setMedicines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title={data.farmer.displayName}
        subtitle={data.status === "requested" ? "বিশেষজ্ঞের অপেক্ষায়" : "কৃষি পরামর্শ"}
        onBack={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5 pb-16 pt-4"
      >
        <ConsultStatusChip status={data.status} />

        <View className="gap-3 rounded-3xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <Ionicons name="leaf-outline" size={20} color={colors.primary} />
            </View>
            <AppText variant="body" className="font-bengali-semibold">
              সমস্যা
            </AppText>
          </View>
          <AppText variant="body">{data.problemText}</AppText>
          <View className="flex-row items-center gap-2 border-t border-border pt-3">
            <Ionicons name="person-outline" size={16} color={colors.muted} />
            <AppText variant="caption" className="flex-1">
              {data.specialist
                ? `বিশেষজ্ঞ: ${data.specialist.displayName}`
                : "বিশেষজ্ঞ এখনো যোগ দেননি"}
            </AppText>
          </View>
        </View>

        {data.status === "requested" && mine ? (
          <PrimaryButton label="অনুরোধ গ্রহণ করুন" loading={accepting} onPress={() => void onAccept()} />
        ) : null}

        {canCall || canAnswer || data.status === "accepted" || liveCall ? (
          <View className="items-center gap-4 rounded-3xl border border-border bg-card px-4 py-6">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <Ionicons name={liveCall ? "call" : "person"} size={32} color={colors.primary} />
            </View>
            <View className="items-center gap-1">
              <AppText variant="title" className="text-center">
                {peerName}
              </AppText>
              <AppText variant="caption" className="text-center">
                {data.status === "ringing"
                  ? mine
                    ? "কৃষককে কল করা হচ্ছে"
                    : "কল আসছে"
                  : data.status === "in_call"
                    ? "কলে আছেন"
                    : mine
                      ? "গ্রহণ হয়েছে। এখন কল করতে পারেন।"
                      : "বিশেষজ্ঞ অনুরোধ নিয়েছেন। কল এলে এখানে ধরতে পারবেন।"}
              </AppText>
            </View>
            {canCall ? (
              <PrimaryButton
                label={data.status === "in_call" ? "কলে ফিরে যান" : "কৃষককে কল করুন"}
                icon={<Ionicons name="call" size={22} color={colors.white} />}
                loading={ringing}
                onPress={() => void onCall()}
                className="w-full"
              />
            ) : null}
            {canAnswer ? (
              <PrimaryButton
                label="কল ধরুন"
                icon={<Ionicons name="call" size={22} color={colors.white} />}
                onPress={() =>
                  router.push({
                    pathname: "/(root)/consult/call",
                    params: { consultId },
                  } as never)
                }
                className="w-full"
              />
            ) : null}
          </View>
        ) : null}
        {data.farmer.id === me?.id && data.status === "requested" ? (
          <View className="rounded-3xl border border-border bg-harvest-soft px-4 py-3">
            <AppText variant="body">বিশেষজ্ঞ অনুরোধটি দেখছেন।</AppText>
          </View>
        ) : null}
        {!CALL_URL && (data.status === "accepted" || data.status === "ringing" || data.status === "in_call") ? (
          <View className="rounded-3xl border border-border bg-harvest-soft px-4 py-3">
            <AppText variant="caption" className="text-ink">
              ভিডিও সেবা এখনো চালু হয়নি। পরামর্শ লেখা ও পিডিএফ চালু আছে।
            </AppText>
          </View>
        ) : null}

        {canWrite ? (
          <FormSection title="পরামর্শ লিখুন">
            <FieldInput
              label="সারাংশ"
              value={summary}
              onChangeText={setSummary}
              multiline
              textAlignVertical="top"
              placeholder="সমস্যা কী এবং কী করতে হবে"
              className="min-h-24 py-3"
            />
            <FieldInput
              label="করণীয়"
              value={steps}
              onChangeText={setSteps}
              multiline
              textAlignVertical="top"
              placeholder="ধাপে ধাপে যা করবেন"
              className="min-h-24 py-3"
            />
            {medicines.map((item, index) => (
              <View key={index} className="gap-3 rounded-2xl border border-border bg-neutral p-3">
                <View className="flex-row items-center justify-between">
                  <AppText variant="caption" className="font-bengali-semibold text-muted">
                    ওষুধ {index + 1}
                  </AppText>
                  {medicines.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="এই ওষুধ বাদ দিন"
                      onPress={() => setMedicines((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
                <FieldInput
                  label="নাম"
                  value={item.name}
                  onChangeText={(name) => patchMedicine(index, { name })}
                  placeholder="ওষুধের নাম"
                />
                <FieldInput
                  label="মাত্রা"
                  value={item.dose}
                  onChangeText={(dose) => patchMedicine(index, { dose })}
                  placeholder="কতটুকু"
                />
                <FieldInput
                  label="প্রয়োগ"
                  value={item.howToApply}
                  onChangeText={(howToApply) => patchMedicine(index, { howToApply })}
                  placeholder="কীভাবে দেবেন"
                />
              </View>
            ))}
            <SecondaryButton
              label="আরেকটি ওষুধ"
              icon={<Ionicons name="add" size={20} color={colors.primary} />}
              onPress={() => setMedicines((rows) => [...rows, emptyMedicine()])}
            />
            <PrimaryButton
              label="পরামর্শ সেভ করুন"
              loading={saving}
              disabled={summary.trim().length < 2 || steps.trim().length < 2}
              onPress={() => void onSave()}
            />
          </FormSection>
        ) : null}

        {data.advice ? (
          <View className="gap-3 rounded-3xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                <Ionicons name="medkit-outline" size={20} color={colors.primary} />
              </View>
              <AppText variant="body" className="font-bengali-semibold">
                পরামর্শ
              </AppText>
            </View>
            <AppText variant="body">{data.advice.summaryBn}</AppText>
            <AppText variant="body">{data.advice.steps}</AppText>
            {data.advice.medicines.map((item) => (
              <View
                key={`${item.name}-${item.dose}`}
                className="rounded-2xl bg-neutral px-3 py-3"
              >
                <AppText variant="body" className="font-bengali-semibold">
                  {item.name}
                </AppText>
                <AppText variant="caption" className="mt-1">
                  {item.dose}
                </AppText>
                <AppText variant="caption">{item.howToApply}</AppText>
              </View>
            ))}
            <PrimaryButton
              label="পিডিএফ ডাউনলোড"
              icon={<Ionicons name="download-outline" size={22} color={colors.white} />}
              loading={savingPdf}
              onPress={() => void onPdf()}
            />
          </View>
        ) : null}

        {error ? (
          <AppText variant="caption" className="text-severity-high">
            {error}
          </AppText>
        ) : null}
        {data.status === "requested" || data.status === "accepted" || data.status === "ringing" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="বাতিল"
            disabled={cancelling}
            onPress={() => void cancel(consultId)}
            className="min-h-touch-lg items-center justify-center rounded-2xl border border-danger bg-danger-soft active:opacity-80"
            style={{ opacity: cancelling ? 0.5 : 1 }}
          >
            {cancelling ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <AppText variant="bodyLg" className="font-bengali-bold text-danger">
                বাতিল
              </AppText>
            )}
          </Pressable>
        ) : null}
        {liveCall ? (
          <AppText variant="caption" className="text-center">
            কল শেষ হলে তালিকা থেকে মুছতে পারবেন।
          </AppText>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="তালিকা থেকে মুছুন"
            disabled={deleting}
            onPress={confirmDelete}
            className="min-h-touch-lg flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card active:opacity-80"
            style={{ opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <AppText variant="body" className="font-bengali-semibold text-danger">
                  তালিকা থেকে মুছুন
                </AppText>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
