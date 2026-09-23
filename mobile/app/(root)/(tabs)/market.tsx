import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  DistrictPicker,
  EmptyState,
  IconPickerRow,
  ListingCard,
  PrimaryButton,
  RetryCard,
  SecondaryButton,
  SegmentedTabs,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { HeatMapView } from "@/components/market/HeatMapView";
import { HEAT_COLORS } from "@/components/market/heatmapHtml";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import {
  useCreateMarketListingMutation,
  useGetDistrictsQuery,
  useGetHeatmapQuery,
  useGetMarketListingsQuery,
  useGetMarketPricesQuery,
  useShareListingMutation,
} from "@/services/api";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import {
  type District,
  type HeatLevel,
  type MarketCropType,
  type PriceTrend,
} from "@/types/market";

type MarketTab = "price" | "marketplace" | "heatmap" | "direct";

const TABS: { id: MarketTab; label: string }[] = [
  { id: "price", label: "দাম" },
  { id: "marketplace", label: "বাজার" },
  { id: "heatmap", label: "হিট ম্যাপ" },
  { id: "direct", label: "সরাসরি বিক্রি" },
];

const CROP_OPTIONS: {
  id: MarketCropType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "rice", label: "ধান", icon: "leaf-outline" },
  { id: "potato", label: "আলু", icon: "ellipse-outline" },
  { id: "tomato", label: "টমেটো", icon: "nutrition-outline" },
  { id: "vegetable", label: "সবজি", icon: "basket-outline" },
  { id: "onion", label: "পেঁয়াজ", icon: "flower-outline" },
  { id: "corn", label: "ভুট্টা", icon: "sunny-outline" },
  { id: "lentil", label: "ডাল", icon: "restaurant-outline" },
];

const CROP_FILTER_OPTIONS: { id: MarketCropType | "all"; label: string }[] = [
  { id: "all", label: "সব ফসল" },
  ...CROP_OPTIONS.map((c) => ({ id: c.id, label: c.label })),
];

const HEAT_LEVEL_LABEL: Record<HeatLevel, string> = {
  low: "কম",
  medium: "মাঝারি",
  high: "বেশি",
};

const toBn = (n: number) => new Intl.NumberFormat("bn-BD").format(n);

function cropLabel(cropType: MarketCropType | null) {
  return CROP_OPTIONS.find((c) => c.id === cropType)?.label ?? "";
}

function trendVisual(trend: PriceTrend) {
  if (trend === "up") {
    return { icon: "trending-up" as const, color: colors.primary };
  }
  if (trend === "down") {
    return { icon: "trending-down" as const, color: "#B42318" };
  }
  return { icon: "remove" as const, color: colors.muted };
}

function DraftBanner() {
  return (
    <View className="flex-row items-center gap-2 rounded-2xl bg-severity-medium-bg px-4 py-3">
      <Ionicons name="construct-outline" size={18} color="#B54708" />
      <AppText
        variant="caption"
        className="flex-1 font-bengali-semibold text-severity-medium"
      >
        DRAFT — পণ্যের তথ্য এখনো চূড়ান্ত নয়, পর্যালোচনা প্রয়োজন
      </AppText>
    </View>
  );
}

function FilterChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View className="gap-2">
      <AppText variant="caption" className="font-bengali-semibold text-muted">
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              className={`min-h-touch items-center justify-center rounded-full px-4 ${
                selected ? "bg-primary" : "bg-white"
              }`}
            >
              <AppText
                variant="caption"
                className={`font-bengali-bold ${
                  selected ? "text-white" : "text-ink"
                }`}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function MarketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; photoUri?: string }>();

  const [tab, setTab] = useState<MarketTab>(
    params.tab === "direct" ? "direct" : "price",
  );

  // Price Tracker filters
  const [priceCrop, setPriceCrop] = useState<MarketCropType | "all">("all");
  const [priceDistrict, setPriceDistrict] = useState<District | "all">("all");

  // Marketplace filters
  const [marketCrop, setMarketCrop] = useState<MarketCropType | "all">("all");
  const [marketDistrict, setMarketDistrict] = useState<District | "all">(
    "all",
  );
  const [sortDesc, setSortDesc] = useState(true);

  // Heat Map — built from stored diagnoses, no input needed.
  const [heatSlug, setHeatSlug] = useState<string | null>(null);

  // Direct Sell form — kept at screen level so it survives the round trip
  // to PhotoCaptureScreen and back.
  const [dsCrop, setDsCrop] = useState<MarketCropType | null>(null);
  const [dsQuantity, setDsQuantity] = useState("");
  const [dsPrice, setDsPrice] = useState("");
  const [dsDistrict, setDsDistrict] = useState<District | null>(null);
  const [dsPhotoUri, setDsPhotoUri] = useState<string | null>(null);
  const [dsSubmitted, setDsSubmitted] = useState(false);
  const [createListing, { isLoading: creatingListing }] =
    useCreateMarketListingMutation();
  const [uploadingListing, setUploadingListing] = useState(false);
  const [shareListing] = useShareListingMutation();

  const { data: pricePayload, refetch: refetchPrices } = useGetMarketPricesQuery({
    cropSlug: priceCrop === "all" ? undefined : priceCrop,
    districtSlug: priceDistrict === "all" ? undefined : priceDistrict,
  });
  const { data: listings = [], refetch: refetchListings } =
    useGetMarketListingsQuery({
      cropSlug: marketCrop === "all" ? undefined : marketCrop,
      districtSlug: marketDistrict === "all" ? undefined : marketDistrict,
      sort: sortDesc ? "price_desc" : "price_asc",
    });
  const {
    data: heatmap,
    isLoading: heatmapLoading,
    isError: heatmapError,
    refetch: refetchHeatmap,
  } = useGetHeatmapQuery();
  const heatAreas = heatmap?.areas ?? [];
  const selectedArea = heatAreas.find((a) => a.location.slug === heatSlug);
  const { data: districts = [], refetch: refetchDistricts } =
    useGetDistrictsQuery();

  const refreshMarket = useCallback(async () => {
    await Promise.all([
      refetchPrices(),
      refetchListings(),
      refetchHeatmap(),
      refetchDistricts(),
    ]);
  }, [refetchPrices, refetchListings, refetchHeatmap, refetchDistricts]);

  const { refreshControl } = usePullToRefresh(refreshMarket);
  const districtLabel = (slug: string) =>
    districts.find((d) => d.slug === slug)?.nameBn ?? slug;
  const districtFilterOptions: { id: District | "all"; label: string }[] = [
    { id: "all", label: "সব জেলা" },
    ...districts.map((d) => ({ id: d.slug, label: d.nameBn })),
  ];

  useEffect(() => {
    if (params.tab === "direct") setTab("direct");
    if (params.photoUri) setDsPhotoUri(params.photoUri);
  }, [params.tab, params.photoUri]);

  const filteredPrices = pricePayload?.markets ?? [];

  const bestPriceIds = useMemo(() => {
    return new Set(
      filteredPrices.filter((p) => p.bestPrice).map((p) => p.id),
    );
  }, [filteredPrices]);

  const estimatedRevenue = pricePayload?.estimatedRevenueHero ?? 0;

  const filteredListings = listings;

  const canSubmitListing =
    !!dsCrop && dsQuantity.trim().length > 0 && dsPrice.trim().length > 0 && !!dsDistrict;

  const handleSubmitListing = async () => {
    if (!canSubmitListing || !dsCrop || !dsDistrict) return;
    setUploadingListing(true);
    try {
      const imageUrl = dsPhotoUri
        ? await uploadImageToCloudinary(dsPhotoUri)
        : undefined;
      await createListing({
        cropSlug: dsCrop,
        quantityBn: dsQuantity.trim(),
        askingPricePerKg: Number(dsPrice),
        districtSlug: dsDistrict,
        imageUrl,
      }).unwrap();
      setDsSubmitted(true);
    } catch {
      // keep the form so the farmer can retry
    } finally {
      setUploadingListing(false);
    }
  };

  const openCameraForListing = () => {
    router.push({
      pathname: "/(root)/(tabs)/scan/photo",
      params: { flow: "listing" },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-border bg-white px-5 py-3.5">
        <AppText variant="title">বাজার</AppText>
        <AppText variant="caption" className="mt-0.5">
          দাম, বাজার ও সরাসরি বিক্রির তথ্য
        </AppText>
        <SegmentedTabs
          className="mt-3"
          options={TABS}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5 pb-24"
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {tab === "price" ? (
          <>
            <DraftBanner />
            <FilterChipRow
              label="ফসল"
              options={CROP_FILTER_OPTIONS}
              value={priceCrop}
              onChange={setPriceCrop}
            />
            <FilterChipRow
              label="জেলা"
              options={districtFilterOptions}
              value={priceDistrict}
              onChange={setPriceDistrict}
            />

            {filteredPrices.length === 0 ? (
              <EmptyState
                icon={
                  <Ionicons
                    name="pricetag-outline"
                    size={32}
                    color={colors.primary}
                  />
                }
                message="এখনো কোনো বাজার দাম নেই।"
                ctaLabel="ফিল্টার পরিষ্কার করুন"
                onCta={() => {
                  setPriceCrop("all");
                  setPriceDistrict("all");
                }}
              />
            ) : null}

            {filteredPrices.map((entry) => {
              const trend = trendVisual(entry.trend);
              const isBest = bestPriceIds.has(entry.id);
              return (
                <StructuredCard
                  key={entry.id}
                  title={entry.marketNameBn}
                  icon={
                    <Ionicons
                      name="storefront-outline"
                      size={20}
                      color={colors.primary}
                    />
                  }
                  footer={
                    <AppText variant="caption">
                      {districtLabel(entry.district)} ·{" "}
                      {cropLabel(entry.cropType)}
                    </AppText>
                  }
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-end gap-2">
                      <AppText variant="hero" style={{ fontSize: 32, lineHeight: 38 }}>
                        ৳ {entry.pricePerMon}
                      </AppText>
                      <AppText variant="body" className="mb-1 text-muted">
                        /মণ
                      </AppText>
                    </View>
                    <View className="items-end gap-2">
                      {isBest ? (
                        <View className="rounded-full bg-severity-low-bg px-3 py-1">
                          <AppText
                            variant="caption"
                            className="font-bengali-bold text-severity-low"
                          >
                            সেরা দাম
                          </AppText>
                        </View>
                      ) : null}
                      <View className="flex-row items-center gap-1">
                        <Ionicons name={trend.icon} size={16} color={trend.color} />
                        <AppText
                          variant="caption"
                          className="font-bengali-semibold"
                          style={{ color: trend.color }}
                        >
                          {entry.trend === "flat"
                            ? "অপরিবর্তিত"
                            : `${entry.changePercent}%`}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </StructuredCard>
              );
            })}

            {filteredPrices.length > 0 ? (
              <StructuredCard
                title="আনুমানিক আয়"
                tone="soft"
                icon={
                  <Ionicons name="cash-outline" size={20} color={colors.primary} />
                }
                footer={
                  <AppText variant="caption">
                    সেরা বাজার দাম থেকে আনুমানিক আয়
                  </AppText>
                }
              >
                <AppText variant="hero">৳ {estimatedRevenue}</AppText>
              </StructuredCard>
            ) : null}
          </>
        ) : null}

        {tab === "marketplace" ? (
          <>
            <DraftBanner />
            <FilterChipRow
              label="ফসল"
              options={CROP_FILTER_OPTIONS}
              value={marketCrop}
              onChange={setMarketCrop}
            />
            <FilterChipRow
              label="জেলা"
              options={districtFilterOptions}
              value={marketDistrict}
              onChange={setMarketDistrict}
            />
            <Pressable
              onPress={() => setSortDesc((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel="দাম অনুযায়ী সাজান"
              className="min-h-touch flex-row items-center gap-2 self-start rounded-full bg-white px-4"
            >
              <Ionicons
                name={sortDesc ? "arrow-down" : "arrow-up"}
                size={16}
                color={colors.primary}
              />
              <AppText variant="caption" className="font-bengali-bold text-primary">
                দাম: {sortDesc ? "বেশি থেকে কম" : "কম থেকে বেশি"}
              </AppText>
            </Pressable>

            {filteredListings.length === 0 ? (
              <EmptyState
                icon={
                  <Ionicons
                    name="storefront-outline"
                    size={32}
                    color={colors.primary}
                  />
                }
                message="এই ফিল্টারে কোনো তালিকা মেলেনি।"
                ctaLabel="ফিল্টার পরিষ্কার করুন"
                onCta={() => {
                  setMarketCrop("all");
                  setMarketDistrict("all");
                }}
              />
            ) : (
              <View className="flex-row flex-wrap gap-3">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    sourceName={`${listing.cropNameBn} · ${listing.quantityBn} · ${districtLabel(listing.district)}`}
                    thumbnailUrl={listing.thumbnailUrl}
                    price={listing.askingPriceBn}
                    onPressLink={() => {}}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}

        {tab === "heatmap" ? (
          <>
            <AppText variant="caption" className="text-muted">
              গত {toBn(heatmap?.windowDays ?? 60)} দিনে কৃষকদের স্ক্যান থেকে জেলাভিত্তিক রোগের
              প্রাদুর্ভাব। কোনো এলাকায় চাপ দিন।
            </AppText>

            {heatmapError ? (
              <RetryCard
                message="হিট ম্যাপ আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।"
                onRetry={() => refetchHeatmap()}
              />
            ) : heatmapLoading ? (
              <AIGeneratingShimmer label="মানচিত্র তৈরি হচ্ছে" lines={4} className="w-full" />
            ) : (
              <HeatMapView areas={heatAreas} onSelect={setHeatSlug} />
            )}

            <View className="flex-row items-center justify-center gap-4">
              {(["low", "medium", "high"] as const).map((level) => (
                <View key={level} className="flex-row items-center gap-1.5">
                  <View
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: HEAT_COLORS[level] }}
                  />
                  <AppText variant="caption" className="text-muted">
                    {HEAT_LEVEL_LABEL[level]}
                  </AppText>
                </View>
              ))}
            </View>

            {!heatmapLoading && !heatmapError && heatAreas.length === 0 ? (
              <AppText variant="body" className="text-center text-muted">
                এই সময়ে কোনো রোগের রিপোর্ট নেই।
              </AppText>
            ) : null}

            {selectedArea ? (
              <StructuredCard
                title={selectedArea.location.nameBn}
                icon={
                  <Ionicons name="location" size={20} color={HEAT_COLORS[selectedArea.level]} />
                }
                footer={
                  <AppText variant="caption">
                    মোট {toBn(selectedArea.caseCount)}টি রিপোর্ট · প্রাদুর্ভাব{" "}
                    {HEAT_LEVEL_LABEL[selectedArea.level]}
                  </AppText>
                }
              >
                <View className="gap-2">
                  {selectedArea.diseases.map((d) => (
                    <View
                      key={d.diseaseType.nameEn}
                      className="flex-row items-center justify-between rounded-2xl bg-neutral px-4 py-3"
                    >
                      <AppText variant="body" className="flex-1 pr-3 font-bengali-semibold text-ink">
                        {d.diseaseType.nameBn}
                      </AppText>
                      <AppText variant="body" className="font-bengali-bold text-ink">
                        {toBn(d.caseCount)}টি
                      </AppText>
                    </View>
                  ))}
                </View>
              </StructuredCard>
            ) : heatAreas.length > 0 ? (
              <AppText variant="caption" className="text-center text-muted">
                বিস্তারিত দেখতে মানচিত্রে কোনো বৃত্তে চাপ দিন।
              </AppText>
            ) : null}
          </>
        ) : null}

        {tab === "direct" ? (
          <>
            <DraftBanner />

            {dsSubmitted ? (
              <StructuredCard
                title="তালিকা তৈরি হয়েছে"
                icon={
                  <Ionicons name="cart" size={20} color={colors.primary} />
                }
                footer={
                  // TODO(nestjs): wire real share / marketplace-post
                  // integration once the backend is ready.
                  <SecondaryButton
                    label="শেয়ার করুন"
                    onPress={() => shareListing("latest")}
                    icon={
                      <Ionicons
                        name="share-social-outline"
                        size={20}
                        color={colors.ink}
                      />
                    }
                  />
                }
              >
                <View className="gap-3">
                  {dsPhotoUri ? (
                    <Image
                      source={{ uri: dsPhotoUri }}
                      style={{ height: 160, width: "100%", borderRadius: 16 }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                    {cropLabel(dsCrop)} · {dsQuantity}
                  </AppText>
                  <AppText variant="hero">৳ {dsPrice}/কেজি</AppText>
                  <AppText variant="caption">
                    {dsDistrict ? districtLabel(dsDistrict) : ""}
                  </AppText>
                </View>
              </StructuredCard>
            ) : (
              <>
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
                    value={dsCrop}
                    onChange={(id) => setDsCrop(id as MarketCropType)}
                  />
                </View>

                <View className="gap-3">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    পরিমাণ
                  </AppText>
                  <TextInput
                    value={dsQuantity}
                    onChangeText={setDsQuantity}
                    placeholder="যেমনঃ ৫০০ কেজি"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="পরিমাণ"
                    className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                  />
                </View>

                <View className="gap-3">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    দাম প্রতি কেজি (৳)
                  </AppText>
                  <TextInput
                    value={dsPrice}
                    onChangeText={setDsPrice}
                    keyboardType="numeric"
                    placeholder="যেমনঃ ৩০"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="দাম প্রতি কেজি, টাকা"
                    className="min-h-touch-lg rounded-2xl bg-white px-4 font-bengali-medium text-body-lg text-ink"
                  />
                </View>

                <View className="gap-3">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    জেলা
                  </AppText>
                  <DistrictPicker
                    districts={districts}
                    value={dsDistrict}
                    onChange={setDsDistrict}
                  />
                </View>

                <View className="gap-3">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    ছবি
                  </AppText>
                  {dsPhotoUri ? (
                    <View className="gap-2">
                      <Image
                        source={{ uri: dsPhotoUri }}
                        style={{ height: 160, width: "100%", borderRadius: 16 }}
                        resizeMode="cover"
                      />
                      <SecondaryButton
                        label="আবার তুলুন"
                        onPress={openCameraForListing}
                        icon={<Ionicons name="camera" size={20} color={colors.ink} />}
                      />
                    </View>
                  ) : (
                    <SecondaryButton
                      label="ছবি তুলুন"
                      onPress={openCameraForListing}
                      icon={
                        <Ionicons name="camera-outline" size={20} color={colors.ink} />
                      }
                    />
                  )}
                </View>

                <PrimaryButton
                  label="তালিকা তৈরি করুন"
                  onPress={handleSubmitListing}
                  loading={uploadingListing || creatingListing}
                  disabled={!canSubmitListing}
                  icon={
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                  }
                />
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
