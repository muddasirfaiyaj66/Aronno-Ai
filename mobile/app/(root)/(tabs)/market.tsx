import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  RetryCard,
  SegmentedTabs,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { HeatMapView } from "@/components/market/HeatMapView";
import { HEAT_COLORS } from "@/components/market/heatmapHtml";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { AddProductModal } from "@/components/market/AddProductModal";
import { ShopCreateModal } from "@/components/market/ShopCreateModal";
import { ShopDashboardView } from "@/components/market/ShopDashboardView";
import { ShopPromptCard } from "@/components/market/ShopPromptCard";
import {
  useGetDistrictsQuery,
  useGetHeatmapQuery,
  useGetMyShopQuery,
  useGetProductsQuery,
} from "@/services/api";
import {
  type HeatLevel,
} from "@/types/market";

type MarketTab = "marketplace" | "shop" | "heatmap";

const TABS: { id: MarketTab; label: string }[] = [
  { id: "marketplace", label: "বাজার" },
  { id: "shop", label: "আমার দোকান" },
  { id: "heatmap", label: "হিট ম্যাপ" },
];

type ProductCategory = "all" | "crops" | "vegetables" | "fruits" | "seeds" | "fertilizers" | "pesticides" | "tools" | "fish" | "dairy" | "eggs" | "other";

const CATEGORY_FILTER_OPTIONS: { id: ProductCategory; label: string }[] = [
  { id: "all", label: "সব পণ্য" },
  { id: "crops", label: "ফসল/ধান" },
  { id: "vegetables", label: "সবজি" },
  { id: "fruits", label: "ফলমূল" },
  { id: "seeds", label: "বীজ" },
  { id: "fertilizers", label: "সার" },
  { id: "pesticides", label: "কীটনাশক" },
  { id: "tools", label: "যন্ত্রপাতি" },
  { id: "fish", label: "মাছ" },
  { id: "dairy", label: "দুগ্ধজাত" },
  { id: "eggs", label: "ডিম" },
  { id: "other", label: "অন্যান্য" },
];

const HEAT_LEVEL_LABEL: Record<HeatLevel, string> = {
  low: "কম",
  medium: "মাঝারি",
  high: "বেশি",
};

const toBn = (n: number) => new Intl.NumberFormat("bn-BD").format(n);



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
  const params = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<MarketTab>(
    params.tab === "shop"
      ? "shop"
      : params.tab === "heatmap"
      ? "heatmap"
      : "marketplace",
  );

  // Marketplace product filters
  const [productCategory, setProductCategory] = useState<ProductCategory>("all");
  const [productDistrict, setProductDistrict] = useState<string>("all");
  const [sortDesc, setSortDesc] = useState(true);

  // Heat Map
  const [heatSlug, setHeatSlug] = useState<string | null>(null);

  const [shopModalVisible, setShopModalVisible] = useState(false);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);

  const { data: myShop, isLoading: myShopLoading, refetch: refetchMyShop } = useGetMyShopQuery();

  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useGetProductsQuery({
    category: productCategory === "all" ? undefined : productCategory,
    districtId: productDistrict === "all" ? undefined : productDistrict,
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
  const { data: districts = [], refetch: refetchDistricts } = useGetDistrictsQuery();

  const refreshMarket = useCallback(async () => {
    await Promise.all([
      refetchProducts(),
      refetchHeatmap(),
      refetchDistricts(),
      refetchMyShop(),
    ]);
  }, [refetchProducts, refetchHeatmap, refetchDistricts, refetchMyShop]);

  const { refreshControl } = usePullToRefresh(refreshMarket);

  const districtFilterOptions: { id: string; label: string }[] = [
    { id: "all", label: "সব জেলা" },
    ...districts.map((d) => ({ id: d.slug, label: d.nameBn })),
  ];

  useEffect(() => {
    if (params.tab === "shop" || params.tab === "heatmap" || params.tab === "marketplace") {
      setTab(params.tab);
    }
  }, [params.tab]);

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-border bg-white px-5 py-3.5">
        <View className="flex-row items-center justify-between">
          <View>
            <AppText variant="title">কৃষি বাজার</AppText>
            <AppText variant="caption" className="mt-0.5">
              দাম, কেনাবেচা ও দোকানের তথ্য
            </AppText>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/(root)/cart")}
              className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
            >
              <Ionicons name="cart-outline" size={20} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(root)/orders")}
              className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
            >
              <Ionicons name="bag-handle-outline" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>
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
        {tab === "marketplace" ? (
          <>
            {/* Category filter */}
            <FilterChipRow
              label="শ্রেণি"
              options={CATEGORY_FILTER_OPTIONS}
              value={productCategory}
              onChange={setProductCategory}
            />
            {/* District filter */}
            <FilterChipRow
              label="জেলা"
              options={districtFilterOptions}
              value={productDistrict}
              onChange={setProductDistrict}
            />
            {/* Sort toggle */}
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

            {productsLoading ? (
              <AIGeneratingShimmer label="পণ্যের তালিকা আনা হচ্ছে" lines={4} className="w-full" />
            ) : productsError ? (
              <RetryCard
                message="পণ্যের তালিকা আনা যায়নি। আবার চেষ্টা করুন।"
                onRetry={refetchProducts}
              />
            ) : products.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="storefront-outline" size={32} color={colors.primary} />}
                message="এই ফিল্টারে কোনো পণ্য পাওয়া যায়নি।"
                ctaLabel="ফিল্টার পরিষ্কার করুন"
                onCta={() => {
                  setProductCategory("all");
                  setProductDistrict("all");
                }}
              />
            ) : (
              <View className="flex-row flex-wrap gap-3">
                {products.map((product: any) => {
                  const imageUrl = product.images?.[0]?.url;
                  return (
                    <Pressable
                      key={product.id}
                      onPress={() => router.push({ pathname: "/(root)/product/[id]", params: { id: product.id } })}
                      className="w-[47%] overflow-hidden rounded-3xl bg-white shadow-sm"
                    >
                      {/* Product image */}
                      <View className="h-36 w-full overflow-hidden bg-neutral">
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-full w-full items-center justify-center bg-primary/10">
                            <Ionicons name="cube" size={32} color={colors.primary} />
                          </View>
                        )}
                        {product.isOrganic ? (
                          <View className="absolute left-2 top-2 flex-row items-center gap-0.5 rounded-full bg-severity-low-bg px-2 py-0.5">
                            <Ionicons name="leaf" size={10} color="#027A48" />
                            <AppText variant="caption" style={{ color: "#027A48", fontSize: 10 }} className="font-bengali-bold">
                              জৈব
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      {/* Product info */}
                      <View className="gap-1 p-3">
                        <AppText variant="body" className="font-bengali-bold text-ink" numberOfLines={2}>
                          {product.name}
                        </AppText>
                        <AppText variant="body" className="font-bengali-bold text-primary">
                          ৳ {product.pricePerUnit}/{product.unit}
                        </AppText>
                        <AppText variant="caption" className="text-muted" numberOfLines={1}>
                          মজুদ: {product.availableQuantity} {product.unit}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {tab === "shop" ? (
          myShopLoading ? (
            <AIGeneratingShimmer label="দোকানের তথ্য লোড হচ্ছে" lines={4} className="w-full" />
          ) : myShop ? (
            <ShopDashboardView
              shop={myShop}
              onEditShop={() => setShopModalVisible(true)}
              onAddProduct={() => setAddProductModalVisible(true)}
              onViewMyProducts={() => router.push("/(root)/shop/my-products")}
            />
          ) : (
            <ShopPromptCard onCreateShop={() => setShopModalVisible(true)} />
          )
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
      </ScrollView>

      <ShopCreateModal
        visible={shopModalVisible}
        onClose={() => setShopModalVisible(false)}
        existingShop={myShop}
      />

      <AddProductModal
        visible={addProductModalVisible}
        onClose={() => setAddProductModalVisible(false)}
      />
    </SafeAreaView>
  );
}
