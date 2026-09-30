import { useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppText,
  FieldInput,
  PrimaryButton,
  ScreenHeader,
} from "@/components/ui";
import {
  ConsultMessageMic,
  type ConsultMicNotice,
} from "@/components/consult/ConsultMessageMic";
import { ConsultStatusChip } from "@/components/consult/ConsultStatusChip";
import { colors } from "@/constants/theme";
import { useAppSelector } from "@/store";
import {
  getApiError,
  useCreateConsultMutation,
  useDeleteConsultMutation,
  useGetHistoryQuery,
  useListConsultsQuery,
  useListSpecialistsQuery,
} from "@/services/api";
import type { ConsultStatus, SpecialistCard } from "@/types/consult";

const DELETABLE: ConsultStatus[] = ["requested", "accepted", "ended", "completed", "cancelled"];

const SPECIALISTS = new Set(["agronomist", "extension_officer"]);

export default function ConsultHome() {
  const router = useRouter();
  const me = useAppSelector((s) => s.auth.user);
  const specialist =
    !!me?.specialistApproved && SPECIALISTS.has(me.profession?.slug ?? "");
  const { data, refetch, isFetching } = useListConsultsQuery(undefined, {
    pollingInterval: 5000,
  });
  const { data: people = [], refetch: refetchPeople } = useListSpecialistsQuery(undefined, {
    skip: specialist,
    pollingInterval: specialist ? 0 : 8000,
  });
  const { data: history } = useGetHistoryQuery(undefined, { skip: specialist });
  const [create, { isLoading }] = useCreateConsultMutation();
  const [removeConsult] = useDeleteConsultMutation();
  const [picked, setPicked] = useState<SpecialistCard | null>(null);
  const [problem, setProblem] = useState("");
  const [error, setError] = useState("");
  const [micNotice, setMicNotice] = useState<ConsultMicNotice | null>(null);
  const latestDisease = history?.find((entry) => entry.kind === "disease");
  const items = data?.items ?? [];
  const incoming = items.find(
    (item) => item.status === "ringing" || item.status === "in_call",
  );
  const online = people.filter((person) => person.online);
  const offline = people.filter((person) => !person.online);

  async function submit() {
    if (!picked) return;
    setError("");
    setMicNotice((current) => (current?.kind === "error" ? null : current));
    try {
      const created = await create({
        specialistId: picked.id,
        problemText: problem.trim(),
        diagnosisId:
          latestDisease?.kind === "disease" &&
          latestDisease.sourceId &&
          /^[a-f0-9]{24}$/i.test(latestDisease.sourceId)
            ? latestDisease.sourceId
            : undefined,
      }).unwrap();
      setProblem("");
      setMicNotice(null);
      setPicked(null);
      router.push(`/(root)/consult/${created.id}` as never);
    } catch (err) {
      setError(getApiError(err).message || "অনুরোধ পাঠানো যায়নি।");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title={specialist ? "আসা অনুরোধ" : "বিশেষজ্ঞ বেছে নিন"}
        subtitle={
          specialist
            ? "অনুরোধ গ্রহণ করে কৃষককে কল করুন।"
            : "যিনি অনলাইনে আছেন, তাকে বার্তা পাঠান। তিনি গ্রহণ করে কল করবেন।"
        }
        onBack={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5 pb-16 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => {
              void refetch();
              if (!specialist) void refetchPeople();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {incoming ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(root)/consult/${incoming.id}` as never)}
            className="gap-2 rounded-3xl bg-primary px-4 py-4"
          >
            <AppText variant="caption" className="font-bengali-semibold" style={{ color: colors.white }}>
              {specialist ? (incoming.status === "in_call" ? "কলে আছেন" : "কল করা হচ্ছে") : "কল আসছে"}
            </AppText>
            <AppText variant="bodyLg" className="font-bengali-bold" style={{ color: colors.white }}>
              {specialist
                ? incoming.farmer.displayName
                : `${incoming.specialist?.displayName ?? "বিশেষজ্ঞ"} কল করছেন`}
            </AppText>
            <AppText variant="caption" style={{ color: colors.white }}>
              {specialist ? "খুলতে চাপুন" : "ধরতে চাপুন"}
            </AppText>
          </Pressable>
        ) : null}

        {specialist ? null : (
          <>
            <SpecialistList
              title="এখন অনলাইনে"
              people={online}
              empty="এই মুহূর্তে কেউ অনলাইনে নেই।"
              pickedId={picked?.id}
              onPick={setPicked}
            />
            <SpecialistList
              title="পরে দেখবেন"
              people={offline}
              empty="অফলাইনে আর কেউ নেই।"
              pickedId={picked?.id}
              onPick={setPicked}
            />
            {picked ? (
              <View className="gap-3 rounded-3xl border border-border bg-card p-4">
                <AppText variant="body" className="font-bengali-semibold">
                  {picked.displayName}-কে অনুরোধ
                </AppText>
                <FieldInput
                  label="বার্তা"
                  value={problem}
                  onChangeText={(text) => {
                    setProblem(text);
                    setMicNotice((current) => (current?.kind === "error" ? null : current));
                  }}
                  multiline
                  textAlignVertical="top"
                  placeholder="ফসলের সমস্যা সংক্ষেপে লিখুন"
                  className="min-h-28 py-3"
                  error={error || (micNotice?.kind === "error" ? micNotice.text : undefined)}
                  hint={
                    [
                      micNotice && micNotice.kind !== "error" ? micNotice.text : null,
                      latestDisease?.kind === "disease"
                        ? `শেষ স্ক্যান যুক্ত হবে: ${latestDisease.diseaseNameBn}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  trailing={
                    <ConsultMessageMic
                      disabled={isLoading}
                      onTranscript={(spoken) => {
                        setProblem((prev) => {
                          const base = prev.trim();
                          return base ? `${base} ${spoken}` : spoken;
                        });
                        setError("");
                      }}
                      onNotice={(notice) => {
                        setMicNotice(notice);
                        if (notice && notice.kind !== "error") setError("");
                      }}
                    />
                  }
                />
                <PrimaryButton
                  label="অনুরোধ পাঠান"
                  loading={isLoading}
                  disabled={
                    problem.trim().length < 4 ||
                    micNotice?.kind === "recording" ||
                    micNotice?.kind === "transcribing"
                  }
                  onPress={() => void submit()}
                />
              </View>
            ) : null}
          </>
        )}

        <AppText variant="caption" className="px-1 font-bengali-semibold text-muted">
          {specialist ? "আপনার অনুরোধ" : "পাঠানো অনুরোধ"}
        </AppText>
        {items.map((item) => (
          <View
            key={item.id}
            className="rounded-3xl border border-border bg-card p-4"
          >
            <View className="flex-row items-center justify-between gap-3">
              <ConsultStatusChip status={item.status} />
              {DELETABLE.includes(item.status) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="তালিকা থেকে মুছুন"
                  hitSlop={8}
                  onPress={() =>
                    confirmDeleteConsult(() => removeConsult(item.id).unwrap())
                  }
                  className="h-9 w-9 items-center justify-center rounded-full bg-danger-soft"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/(root)/consult/${item.id}` as never)}
              className="active:opacity-80"
            >
              <AppText variant="body" numberOfLines={3} className="mt-3">
                {item.problemText}
              </AppText>
              <View className="mt-2 flex-row items-center justify-between gap-3">
                <AppText variant="caption" className="flex-1">
                  {specialist
                    ? item.farmer.displayName
                    : item.specialist?.displayName ?? "বিশেষজ্ঞ"}
                </AppText>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Pressable>
          </View>
        ))}
        {!isFetching && items.length === 0 ? (
          <View className="items-center rounded-3xl border border-border bg-card px-6 py-10">
            <AppText variant="body" className="text-center text-muted">
              {specialist ? "এখন কোনো অনুরোধ নেই।" : "এখনো কোনো অনুরোধ পাঠাননি।"}
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function confirmDeleteConsult(run: () => Promise<unknown>) {
  Alert.alert("মিটিং মুছবেন?", "এটি শুধু আপনার তালিকা থেকে সরবে। অপর পক্ষ এখনো দেখতে পাবেন।", [
    { text: "না", style: "cancel" },
    {
      text: "মুছুন",
      style: "destructive",
      onPress: () => {
        void run().catch((err: unknown) => {
          Alert.alert("মুছা যায়নি", getApiError(err).message ?? "আবার চেষ্টা করুন।");
        });
      },
    },
  ]);
}

function SpecialistList({
  title,
  people,
  empty,
  pickedId,
  onPick,
}: {
  title: string;
  people: SpecialistCard[];
  empty: string;
  pickedId?: string;
  onPick: (person: SpecialistCard) => void;
}) {
  return (
    <View className="gap-3">
      <AppText variant="caption" className="px-1 font-bengali-semibold text-muted">
        {title}
      </AppText>
      {people.length === 0 ? (
        <AppText variant="caption" className="px-1">
          {empty}
        </AppText>
      ) : (
        people.map((person) => {
          const selected = person.id === pickedId;
          return (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={person.displayName}
              onPress={() => onPick(person)}
              className={`flex-row items-center gap-3 rounded-3xl border bg-card p-4 ${
                selected ? "border-primary" : "border-border"
              }`}
            >
              {person.avatarUrl ? (
                <Image source={{ uri: person.avatarUrl }} className="h-12 w-12 rounded-full" />
              ) : (
                <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
              )}
              <View className="min-w-0 flex-1">
                <AppText variant="body" className="font-bengali-semibold" numberOfLines={1}>
                  {person.displayName}
                </AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {person.profession}
                  {person.district ? ` · ${person.district}` : ""}
                </AppText>
              </View>
              <View className="items-end gap-1">
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: person.online ? colors.primary : colors.neutral300 }}
                />
                <AppText variant="caption">{person.online ? "অনলাইন" : "অফলাইন"}</AppText>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
