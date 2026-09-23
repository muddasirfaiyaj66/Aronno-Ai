/** Public market / heat map types + BFF helpers (no auth required). */

export type HeatLevel = "low" | "medium" | "high";

export type HeatmapLocation = {
  slug: string;
  nameBn: string;
  lat: number;
  lon: number;
};

export type HeatmapDisease = {
  diseaseType: { nameBn: string; nameEn: string };
  caseCount: number;
  severityScore: number;
};

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
  areas: HeatmapArea[];
};

export type MarketPriceRow = {
  id: string;
  marketNameBn: string;
  district: string;
  cropType: string;
  pricePerMon: number;
  trend: "up" | "down" | "flat" | string;
  changePercent: number;
  bestPrice?: boolean;
};

export type MarketPricesResponse = {
  markets: MarketPriceRow[];
  estimatedRevenueHero?: number;
};

export type PublicProduct = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  pricePerUnit: number;
  unit: string;
  availableQuantity: number;
  images?: Array<{ url: string }>;
  avgRating?: number;
  reviewCount?: number;
  district?: { slug: string; nameBn: string } | null;
  shop?: { id: string; name: string } | null;
};

export type ProductsPage = {
  items: PublicProduct[];
  total: number;
  page: number;
  totalPages: number;
};

export type PublicShop = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  phone?: string;
  district?: { slug: string; nameBn: string } | null;
  _count?: { products: number };
  avgRating?: number;
};

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

async function publicFetch<T>(path: string): Promise<T> {
  const url = path.startsWith("/api") ? path : `/api${path}`;
  const res = await fetch(url, {
    // Public GETs — no cookies required
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | T | null;
  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "success" in json && !json.success
        ? json.error.message
        : `অনুরোধ ব্যর্থ (${res.status})`;
    throw new Error(msg);
  }
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) throw new Error(json.error.message);
    return json.data;
  }
  return json as T;
}

export function fetchHeatmap(days = 60) {
  return publicFetch<HeatmapResponse>(`/market/heatmap?days=${days}`);
}

export function fetchMarketPrices() {
  return publicFetch<MarketPricesResponse>("/market/prices");
}

export function fetchPublicProducts(limit = 24) {
  return publicFetch<ProductsPage>(
    `/marketplace/products?limit=${limit}&page=1`,
  );
}

export function fetchPublicShops(limit = 12) {
  return publicFetch<{ items: PublicShop[] }>(
    `/marketplace/shops?limit=${limit}`,
  ).then((data) => data.items ?? []);
}

export const HEAT_COLORS: Record<HeatLevel, string> = {
  low: "#3f9a74",
  medium: "#a86b1a",
  high: "#b42318",
};

export const HEAT_LABEL_BN: Record<HeatLevel, string> = {
  low: "কম",
  medium: "মাঝারি",
  high: "বেশি",
};

export function formatTaka(n: number) {
  return `৳ ${n.toLocaleString("bn-BD")}`;
}
