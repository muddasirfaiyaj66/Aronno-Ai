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

export type District =
  | "jashore"
  | "munshiganj"
  | "bogura"
  | "rangpur"
  | "comilla";

export const DISTRICT_LABELS: Record<District, string> = {
  jashore: "যশোর",
  munshiganj: "মুন্সিগঞ্জ",
  bogura: "বগুড়া",
  rangpur: "রংপুর",
  comilla: "কুমিল্লা",
};

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

export type HeatMapDimension = "disease" | "price";

export type HeatMapRegion = {
  id: string;
  district: District;
  /** 0-1 intensity from the market heatmap API. */
  diseaseIntensity: number;
  priceIntensity: number;
};
