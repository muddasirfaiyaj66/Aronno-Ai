import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
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
  useGetCartQuery,
  useGetDistrictsQuery,
  useGetHeatmapQuery,
  useGetMyShopQuery,
  useGetProductsQuery,
  useGetShopsQuery,
} from "@/services/api";
import { type HeatLevel } from "@/types/market";
import {
  formatPriceBn,
  formatUnitBn,
  toBn,
} from "@/utils/marketFormatters";

type MarketTab = "marketplace" | "shop" | "heatmap";

const TABS: { id: MarketTab; label: string }[] = [
  { id: "marketplace", label: "কৃষি মার্কেট" },
  { id: "shop", label: "আমার দোকান" },
  { id: "heatmap", label: "হিট ম্যাপ" },
];

type SearchMode = "products" | "shops";

const SEARCH_MODE_OPTIONS: { id: SearchMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "products", label: "পণ্যসামগ্রী", icon: "cube-outline" },
  { id: "shops", label: "দোকানসমূহ", icon: "storefront-outline" },
];

type ProductCategory =
  | "all"
  | "crops"
  | "vegetables"
  | "fruits"
  | "seeds"
  | "fertilizers"
  | "pesticides"
  | "tools"
  | "fish"
  | "dairy"
  | "eggs"
  | "other";

const CATEGORY_FILTER_OPTIONS: { id: ProductCategory; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "crops", label: "শস্য ও ফসল" },
  { id: "vegetables", label: "সবজি" },
  { id: "fruits", label: "ফলমূল" },
  { id: "seeds", label: "বীজ" },
  { id: "fertilizers", label: "সার" },
  { id: "pesticides", label: "কীটনাশক" },
  { id: "tools", label: "যন্ত্রপাতি ও সরঞ্জাম" },
  { id: "fish", label: "মাছ" },
  { id: "dairy", label: "দুধ ও দুগ্ধজাত পণ্য" },
  { id: "eggs", label: "ডিম" },
  { id: "other", label: "অন্যান্য" },
];

type SortOption = "newest" | "price_asc" | "price_desc" | "rating";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "newest", label: "নতুন পণ্য" },
  { id: "price_asc", label: "দাম: কম থেকে বেশি" },
  { id: "price_desc", label: "দাম: বেশি থেকে কম" },
  { id: "rating", label: "সর্বোচ্চ রেটিং" },
];

const HEAT_LEVEL_LABEL: Record<HeatLevel, string> = {
  low: "কম",
  medium: "মাঝারি",
  high: "বেশি",
};

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

  // Search Mode: products vs shops
  const [searchMode, setSearchMode] = useState<SearchMode>("products");

  // Marketplace search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [productCategory, setProductCategory] = useState<ProductCategory>("all");
  const [productDistrict, setProductDistrict] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Heat Map
  const [heatSlug, setHeatSlug] = useState<string | null>(null);

  const [shopModalVisible, setShopModalVisible] = useState(false);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);

  const { data: myShop, isLoading: myShopLoading, refetch: refetchMyShop } = useGetMyShopQuery();

  // Query Products
  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useGetProductsQuery(
    {
      category: productCategory === "all" ? undefined : productCategory,
      districtId: productDistrict === "all" ? undefined : productDistrict,
      search: debouncedSearch || undefined,
      sort: sortOption,
      page,
      limit: 20,
    },
    { skip: tab !== "marketplace" || searchMode !== "products" },
  );

  // Query Shops
  const {
    data: shopsData,
    isLoading: shopsLoading,
    isError: shopsError,
    refetch: refetchShops,
  } = useGetShopsQuery(
    {
      search: debouncedSearch || undefined,
      districtId: productDistrict === "all" ? undefined : productDistrict,
      page,
      limit: 20,
    },
    { skip: tab !== "marketplace" || searchMode !== "shops" },
  );

  const products = productsData?.items ?? [];
  const totalProducts = productsData?.total ?? 0;
  const productTotalPages = productsData?.totalPages ?? 1;

  const shops = shopsData?.items ?? [];
  const totalShops = shopsData?.total ?? 0;
  const shopTotalPages = shopsData?.totalPages ?? 1;

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
      refetchShops(),
      refetchHeatmap(),
      refetchDistricts(),
      refetchMyShop(),
    ]);
  }, [refetchProducts, refetchShops, refetchHeatmap, refetchDistricts, refetchMyShop]);

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

  const { data: cart } = useGetCartQuery();
  const cartItemCount = cart?.items?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header Bar */}
      <View className="border-b border-border bg-white px-5 py-3.5">
        <View className="flex-row items-center justify-between">
          <View>
            <AppText variant="title">কৃষি মার্কেট</AppText>
            <AppText variant="caption" className="mt-0.5 text-muted">
              সহজে কৃষি পণ্য ও দোকান খুঁজুন
            </AppText>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/(root)/cart")}
              className="relative h-10 w-10 items-center justify-center rounded-full bg-neutral"
            >
              <Ionicons name="cart-outline" size={20} color={colors.ink} />
              {cartItemCount > 0 ? (
                <View className="absolute -top-1 -right-1 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 border-2 border-white shadow-xs">
                  <AppText
                    variant="caption"
                    className="font-bengali-bold text-white"
                    style={{ fontSize: 10, lineHeight: 12 }}
                  >
                    {toBn(cartItemCount)}
                  </AppText>
                </View>
              ) : null}
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
            {/* Mode Switcher: Products vs Shops */}
            <View className="flex-row rounded-2xl bg-white p-1 border border-border">
              {SEARCH_MODE_OPTIONS.map((mode) => {
                const selected = mode.id === searchMode;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => {
                      setSearchMode(mode.id);
                      setPage(1);
                    }}
                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2 ${
                      selected ? "bg-primary shadow-xs" : "bg-transparent"
                    }`}
                  >
                    <Ionicons
                      name={mode.icon}
                      size={18}
                      color={selected ? colors.white : colors.ink}
                    />
                    <AppText
                      variant="body"
                      className={`font-bengali-bold ${
                        selected ? "text-white" : "text-ink"
                      }`}
                    >
                      {mode.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {/* Search Input Bar */}
            <View className="flex-row items-center rounded-2xl border border-border bg-white px-3.5 py-2.5 shadow-sm">
              <Ionicons name="search" size={20} color={colors.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={
                  searchMode === "products"
                    ? "পণ্য খুঁজুন..."
                    : "দোকানের নাম বা ঠিকানা দিয়ে খুঁজুন..."
                }
                placeholderTextColor={colors.muted}
                className="ml-2 flex-1 font-bengali-medium text-ink"
                style={{ fontSize: 14, paddingVertical: 2 }}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")} className="p-1">
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            {/* District filter */}
            <FilterChipRow
              label="জেলা"
              options={districtFilterOptions}
              value={productDistrict}
              onChange={(dist) => {
                setProductDistrict(dist);
                setPage(1);
              }}
            />

            {/* Mode 1: Products */}
            {searchMode === "products" ? (
              <>
                {/* Category filter */}
                <FilterChipRow
                  label="শ্রেণি"
                  options={CATEGORY_FILTER_OPTIONS}
                  value={productCategory}
                  onChange={(cat) => {
                    setProductCategory(cat);
                    setPage(1);
                  }}
                />

                {/* Sort Filter Row */}
                <FilterChipRow
                  label="সাজান"
                  options={SORT_OPTIONS}
                  value={sortOption}
                  onChange={(s) => {
                    setSortOption(s);
                    setPage(1);
                  }}
                />

                {/* Product List */}
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
                      setSearchQuery("");
                      setProductCategory("all");
                      setProductDistrict("all");
                      setSortOption("newest");
                      setPage(1);
                    }}
                  />
                ) : (
                  <>
                    <View className="flex-row items-center justify-between px-1">
                      <AppText variant="caption" className="font-bengali-semibold text-muted">
                        মোট {toBn(totalProducts)}টি পণ্য পাওয়া গেছে
                      </AppText>
                    </View>

                    <View className="flex-row flex-wrap gap-3">
                      {products.map((product: any) => {
                        const imageUrl = product.images?.[0]?.url;
                        return (
                          <Pressable
                            key={product.id}
                            onPress={() =>
                              router.push({
                                pathname: "/(root)/product/[id]",
                                params: { id: product.id },
                              })
                            }
                            className="w-[47%] overflow-hidden rounded-3xl bg-white shadow-sm border border-border/50"
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
                                <View className="absolute left-2 top-2 flex-row items-center gap-0.5 rounded-full bg-severity-low-bg px-2 py-0.5 shadow-sm">
                                  <Ionicons name="leaf" size={10} color="#027A48" />
                                  <AppText
                                    variant="caption"
                                    style={{ color: "#027A48", fontSize: 10 }}
                                    className="font-bengali-bold"
                                  >
                                    জৈব
                                  </AppText>
                                </View>
                              ) : null}
                            </View>

                            {/* Product info */}
                            <View className="gap-1 p-3">
                              <AppText
                                variant="body"
                                className="font-bengali-bold text-ink"
                                numberOfLines={1}
                              >
                                {product.name}
                              </AppText>
                              <AppText variant="body" className="font-bengali-bold text-primary">
                                {formatPriceBn(product.pricePerUnit, product.unit)}
                              </AppText>
                              {product.availableQuantity !== undefined && product.availableQuantity !== null ? (
                                <AppText variant="caption" className="text-muted" numberOfLines={1}>
                                  মজুদ: {toBn(product.availableQuantity)} {formatUnitBn(product.unit)}
                                </AppText>
                              ) : null}
                              {product.shop?.name ? (
                                <View className="flex-row items-center gap-1 mt-0.5">
                                  <Ionicons name="storefront-outline" size={12} color={colors.muted} />
                                  <AppText
                                    variant="caption"
                                    className="flex-1 text-muted font-bengali-medium"
                                    numberOfLines={1}
                                  >
                                    {product.shop.name}
                                  </AppText>
                                </View>
                              ) : null}
                              {product.district?.nameBn ? (
                                <View className="flex-row items-center gap-1">
                                  <Ionicons name="location-outline" size={12} color={colors.muted} />
                                  <AppText
                                    variant="caption"
                                    className="flex-1 text-muted font-bengali-medium"
                                    numberOfLines={1}
                                  >
                                    {product.district.nameBn}
                                  </AppText>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Pagination Controls */}
                    {productTotalPages > 1 ? (
                      <View className="flex-row items-center justify-center gap-3 mt-4">
                        <Pressable
                          disabled={page <= 1}
                          onPress={() => setPage((p) => Math.max(1, p - 1))}
                          className={`h-10 rounded-full px-4 items-center justify-center flex-row gap-1 ${
                            page <= 1 ? "bg-neutral border border-border" : "bg-white border border-primary"
                          }`}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={16}
                            color={page <= 1 ? colors.muted : colors.primary}
                          />
                          <AppText
                            variant="caption"
                            className={`font-bengali-bold ${
                              page <= 1 ? "text-muted" : "text-primary"
                            }`}
                          >
                            পূর্ববর্তী
                          </AppText>
                        </Pressable>

                        <AppText variant="body" className="font-bengali-bold text-ink px-2">
                          {toBn(page)} / {toBn(productTotalPages)}
                        </AppText>

                        <Pressable
                          disabled={page >= productTotalPages}
                          onPress={() => setPage((p) => Math.min(productTotalPages, p + 1))}
                          className={`h-10 rounded-full px-4 items-center justify-center flex-row gap-1 ${
                            page >= productTotalPages
                              ? "bg-neutral border border-border"
                              : "bg-white border border-primary"
                          }`}
                        >
                          <AppText
                            variant="caption"
                            className={`font-bengali-bold ${
                              page >= productTotalPages ? "text-muted" : "text-primary"
                            }`}
                          >
                            পরবর্তী
                          </AppText>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={page >= productTotalPages ? colors.muted : colors.primary}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              /* Mode 2: Shops */
              <>
                {shopsLoading ? (
                  <AIGeneratingShimmer label="দোকানের তালিকা আনা হচ্ছে" lines={4} className="w-full" />
                ) : shopsError ? (
                  <RetryCard
                    message="দোকানের তালিকা আনা যায়নি। আবার চেষ্টা করুন।"
                    onRetry={refetchShops}
                  />
                ) : shops.length === 0 ? (
                  <EmptyState
                    icon={<Ionicons name="storefront-outline" size={32} color={colors.primary} />}
                    message="এই ফিল্টারে কোনো দোকান পাওয়া যায়নি।"
                    ctaLabel="ফিল্টার পরিষ্কার করুন"
                    onCta={() => {
                      setSearchQuery("");
                      setProductDistrict("all");
                      setPage(1);
                    }}
                  />
                ) : (
                  <>
                    <View className="flex-row items-center justify-between px-1">
                      <AppText variant="caption" className="font-bengali-semibold text-muted">
                        মোট {toBn(totalShops)}টি দোকান পাওয়া গেছে
                      </AppText>
                    </View>

                    <View className="gap-3">
                      {shops.map((shopItem: any) => {
                        const locationText = [
                          shopItem.district?.nameBn,
                          shopItem.upazila,
                        ]
                          .filter(Boolean)
                          .join(" · ");

                        return (
                          <Pressable
                            key={shopItem.id}
                            onPress={() =>
                              router.push({
                                pathname: "/(root)/shop/[id]",
                                params: { id: shopItem.id },
                              })
                            }
                            className="rounded-3xl bg-white p-4 shadow-sm border border-border/50 flex-row items-center gap-3.5"
                          >
                            {/* Logo */}
                            {shopItem.logoUrl ? (
                              <Image
                                source={{ uri: shopItem.logoUrl }}
                                className="h-16 w-16 rounded-2xl bg-neutral"
                                resizeMode="cover"
                              />
                            ) : (
                              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                <Ionicons name="storefront" size={28} color={colors.primary} />
                              </View>
                            )}

                            {/* Shop Details */}
                            <View className="flex-1 gap-1">
                              <AppText
                                variant="subtitle"
                                className="font-bengali-bold text-ink"
                                numberOfLines={1}
                              >
                                {shopItem.name}
                              </AppText>

                              {shopItem.owner?.displayName ? (
                                <AppText variant="caption" className="text-muted font-bengali-medium">
                                  বিক্রেতা: {shopItem.owner.displayName}
                                </AppText>
                              ) : null}

                              <View className="flex-row items-center gap-2 flex-wrap mt-0.5">
                                {locationText ? (
                                  <View className="flex-row items-center gap-0.5">
                                    <Ionicons name="location-outline" size={12} color={colors.muted} />
                                    <AppText variant="caption" className="text-muted font-bengali-medium">
                                      {locationText}
                                    </AppText>
                                  </View>
                                ) : null}

                                <View className="rounded-full bg-primary/10 px-2 py-0.5">
                                  <AppText
                                    variant="caption"
                                    className="font-bengali-bold text-primary"
                                    style={{ fontSize: 11 }}
                                  >
                                    পণ্য: {toBn(shopItem._count?.products ?? 0)}টি
                                  </AppText>
                                </View>
                              </View>
                            </View>

                            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Pagination Controls for Shops */}
                    {shopTotalPages > 1 ? (
                      <View className="flex-row items-center justify-center gap-3 mt-4">
                        <Pressable
                          disabled={page <= 1}
                          onPress={() => setPage((p) => Math.max(1, p - 1))}
                          className={`h-10 rounded-full px-4 items-center justify-center flex-row gap-1 ${
                            page <= 1 ? "bg-neutral border border-border" : "bg-white border border-primary"
                          }`}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={16}
                            color={page <= 1 ? colors.muted : colors.primary}
                          />
                          <AppText
                            variant="caption"
                            className={`font-bengali-bold ${
                              page <= 1 ? "text-muted" : "text-primary"
                            }`}
                          >
                            পূর্ববর্তী
                          </AppText>
                        </Pressable>

                        <AppText variant="body" className="font-bengali-bold text-ink px-2">
                          {toBn(page)} / {toBn(shopTotalPages)}
                        </AppText>

                        <Pressable
                          disabled={page >= shopTotalPages}
                          onPress={() => setPage((p) => Math.min(shopTotalPages, p + 1))}
                          className={`h-10 rounded-full px-4 items-center justify-center flex-row gap-1 ${
                            page >= shopTotalPages
                              ? "bg-neutral border border-border"
                              : "bg-white border border-primary"
                          }`}
                        >
                          <AppText
                            variant="caption"
                            className={`font-bengali-bold ${
                              page >= shopTotalPages ? "text-muted" : "text-primary"
                            }`}
                          >
                            পরবর্তী
                          </AppText>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={page >= shopTotalPages ? colors.muted : colors.primary}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </>
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
              onViewOrders={() => router.push("/(root)/seller-orders")}
              onViewPublicShop={() =>
                router.push({
                  pathname: "/(root)/shop/[id]",
                  params: { id: myShop.id },
                })
              }
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
