import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

export type DistrictOption = { slug: string; nameBn: string };

export function DistrictPicker({
  districts,
  value,
  onChange,
}: {
  districts: DistrictOption[];
  value: string | null;
  onChange: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = districts.find((d) => d.slug === value);
  const filtered = districts.filter((d) => {
    const q = query.trim();
    if (!q) return true;
    return d.nameBn.includes(q) || d.slug.includes(q.toLowerCase());
  });

  return (
    <View className="gap-3">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="জেলা খুঁজুন…"
        placeholderTextColor={colors.muted}
        accessibilityLabel="জেলা খুঁজুন"
        className="min-h-touch rounded-2xl border border-neutral-200 bg-neutral px-4 font-bengali-medium text-body text-ink"
      />
      {selected && !query ? (
        <AppText variant="caption" className="text-primary">
          নির্বাচিত: {selected.nameBn}
        </AppText>
      ) : null}
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 220 }}
        className="rounded-2xl border border-neutral-200 bg-white"
      >
        {filtered.length === 0 ? (
          <View className="min-h-touch items-center justify-center px-4 py-6">
            <AppText variant="caption" className="text-center">
              {districts.length === 0 ? "জেলা আনা হচ্ছে…" : "এই নামে জেলা নেই"}
            </AppText>
          </View>
        ) : (
          filtered.map((d) => {
            const active = d.slug === value;
            return (
              <Pressable
                key={d.slug}
                onPress={() => {
                  onChange(d.slug);
                  setQuery("");
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`min-h-touch justify-center border-b border-neutral-100 px-4 ${
                  active ? "bg-secondary" : "bg-white"
                }`}
              >
                <AppText
                  variant="body"
                  className={`font-bengali-semibold ${active ? "text-primary" : "text-ink"}`}
                >
                  {d.nameBn}
                </AppText>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
