// Market's crop vocabulary is intentionally broader than treatment.ts's
// CropType (disease/fertilizer relevance) — a farmer can sell things this
// app doesn't yet diagnose or fertilize-recommend for.
export type MarketCropType =
  | "rice"
  | "potato"
  | "tomato"
  | "vegetable"
  | "onion"
  | "corn"
  | "lentil";

export type District = string;

export type PriceTrend = "up" | "down" | "flat";

export type MarketPriceEntry = {
  id: string;
  marketNameBn: string;
  district: District;
  cropType: MarketCropType;
  pricePerMon: number;
  trend: PriceTrend;
  changePercent: number;
  bestPrice?: boolean;
};

export type MarketListing = {
  id: string;
  cropType: MarketCropType;
  cropNameBn: string;
  quantityBn: string;
  askingPriceBn: string;
  /** Numeric ৳/kg, used for sorting — askingPriceBn is the display string. */
  askingPricePerKg: number;
  district: District;
  sellerNameBn: string;
  thumbnailUrl?: string;
};

export type HeatLevel = "low" | "medium" | "high";

export type HeatmapLocation = {
  slug: District;
  nameBn: string;
  lat: number;
  lon: number;
};

export type HeatmapDisease = {
  diseaseType: { nameBn: string; nameEn: string };
  caseCount: number;
  /** Sum of severity weights (low 1, medium 2, high 3). */
  severityScore: number;
};

/** One district × disease row of the aggregated diagnoses. */
export type HeatmapEntry = HeatmapDisease & { location: HeatmapLocation };

/** Per-district roll-up used for the map zones. */
export type HeatmapArea = {
  location: HeatmapLocation;
  caseCount: number;
  severityScore: number;
  level: HeatLevel;
  diseases: HeatmapDisease[];
};

export type HeatmapResponse = {
  windowDays: number;
  since: string;
  generatedAt: string;
  entries: HeatmapEntry[];
  areas: HeatmapArea[];
};

export type ShopData = {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  phone: string;
  districtId: string;
  upazila?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  district?: { id: string; slug: string; nameBn: string };
  owner?: { id: string; displayName: string; avatarUrl?: string | null; email?: string };
  products?: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    pricePerUnit: number;
    unit: string;
    availableQuantity: number;
    images?: Array<{ url: string; publicId?: string }>;
    avgRating?: number;
    reviewCount?: number;
  }>;
  _count?: { products: number; orders: number };
  avgRating?: number;
  reviewCount?: number;
};
