import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

export type DistrictOption = { id?: string; slug: string; nameBn: string };

export function DistrictPicker({
  districts,
  value,
  onChange,
}: {
  districts: DistrictOption[];
  value: string | null;
  onChange: (idOrSlug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const selected = districts.find((d) => d.slug === value || d.id === value);

  useEffect(() => {
    if (!value && districts.length > 0) {
      const first = districts[0];
      onChange(first.id ?? first.slug);
    }
  }, [districts, value, onChange]);

  const filtered = districts.filter((d) => {
    const q = query.trim();
    if (!q) return true;
    return d.nameBn.includes(q) || d.slug.includes(q.toLowerCase());
  });

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="জেলা নির্বাচন করুন"
        className="min-h-touch flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-card px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <AppText variant="body" className="font-bengali-semibold text-ink">
            {selected ? selected.nameBn : "জেলা নির্বাচন করুন"}
          </AppText>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.muted}
        />
      </Pressable>

      {expanded ? (
        <View className="gap-2 rounded-2xl border border-neutral-200 bg-card p-3 shadow-sm">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="জেলা খুঁজুন…"
            placeholderTextColor={colors.muted}
            accessibilityLabel="জেলা খুঁজুন"
            className="min-h-touch rounded-xl border border-neutral-200 bg-neutral px-4 font-bengali-medium text-body text-ink"
          />

          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 180 }}
            showsVerticalScrollIndicator={true}
          >
            {filtered.length === 0 ? (
              <View className="min-h-touch items-center justify-center px-4 py-4">
                <AppText variant="caption" className="text-center text-muted">
                  {districts.length === 0 ? "জেলা আনা হচ্ছে…" : "এই নামে জেলা নেই"}
                </AppText>
              </View>
            ) : (
              filtered.map((d) => {
                const active = d.slug === value || d.id === value;
                return (
                  <Pressable
                    key={d.slug}
                    onPress={() => {
                      onChange(d.id ?? d.slug);
                      setExpanded(false);
                      setQuery("");
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`min-h-touch justify-center border-b border-neutral-100 px-3 py-2.5 ${
                      active ? "bg-secondary/40" : "bg-card"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <AppText
                        variant="body"
                        className={`font-bengali-semibold ${
                          active ? "text-primary font-bengali-bold" : "text-ink"
                        }`}
                      >
                        {d.nameBn}
                      </AppText>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

