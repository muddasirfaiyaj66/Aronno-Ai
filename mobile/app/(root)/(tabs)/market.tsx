import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  EmptyState,
  SegmentedTabs,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";

type MarketTab = "price" | "marketplace" | "heatmap" | "direct";

const TABS: { id: MarketTab; label: string }[] = [
  { id: "price", label: "দাম" },
  { id: "marketplace", label: "বাজার" },
  { id: "heatmap", label: "হিট ম্যাপ" },
  { id: "direct", label: "সরাসরি বিক্রি" },
];

const MOCK_PRICES = [
  { crop: "ধান (আমন)", price: "৳ ৪৮", unit: "/ কেজি", place: "যশোর" },
  { crop: "আলু", price: "৳ ৩২", unit: "/ কেজি", place: "মুন্সিগঞ্জ" },
  { crop: "টমেটো", price: "৳ ৫৫", unit: "/ কেজি", place: "বগুড়া" },
];

const MOCK_LISTINGS = [
  {
    id: "1",
    title: "তাজা আলু — ৫০০ কেজি",
    seller: "করিম মিয়া",
    place: "মুন্সিগঞ্জ",
    price: "৳ ৩০/কেজি",
  },
  {
    id: "2",
    title: "দেশি টমেটো — ২০০ কেজি",
    seller: "রহিমা বেগম",
    place: "বগুড়া",
    price: "৳ ৫০/কেজি",
  },
];

export default function MarketScreen() {
  const [tab, setTab] = useState<MarketTab>("price");

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">বাজার</AppText>
        <AppText variant="caption" className="mt-1">
          দাম, বাজার ও সরাসরি বিক্রির তথ্য
        </AppText>
        <SegmentedTabs
          className="mt-4"
          options={TABS}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        {tab === "price"
          ? MOCK_PRICES.map((item) => (
              <StructuredCard
                key={item.crop}
                title={item.crop}
                icon={
                  <Ionicons name="pricetag" size={20} color={colors.primary} />
                }
                footer={<AppText variant="caption">বাজার · {item.place}</AppText>}
              >
                <View className="flex-row items-end gap-2">
                  <AppText variant="hero">{item.price}</AppText>
                  <AppText variant="body" className="mb-2 text-muted">
                    {item.unit}
                  </AppText>
                </View>
              </StructuredCard>
            ))
          : null}

        {tab === "marketplace"
          ? MOCK_LISTINGS.map((listing) => (
              <StructuredCard
                key={listing.id}
                title={listing.title}
                icon={
                  <Ionicons
                    name="storefront-outline"
                    size={20}
                    color={colors.primary}
                  />
                }
                footer={
                  <AppText variant="caption">
                    {listing.seller} · {listing.place}
                  </AppText>
                }
              >
                <AppText variant="bodyLg" className="font-bengali-bold text-primary">
                  {listing.price}
                </AppText>
              </StructuredCard>
            ))
          : null}

        {tab === "heatmap" ? (
          <EmptyState
            icon={<Ionicons name="map-outline" size={32} color={colors.primary} />}
            message="হিট ম্যাপ শীঘ্রই আসছে।"
            ctaLabel="দাম দেখুন"
            onCta={() => setTab("price")}
          />
        ) : null}

        {tab === "direct" ? (
          <EmptyState
            icon={<Ionicons name="cart-outline" size={32} color={colors.primary} />}
            message="এখনো কোনো সরাসরি বিক্রির তালিকা নেই।"
            ctaLabel="তালিকা যোগ করুন"
            onCta={() => {}}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
