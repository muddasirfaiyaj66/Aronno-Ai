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
  /** 0-1, mock intensity for each dimension. */
  diseaseIntensity: number;
  priceIntensity: number;
};

// TODO(nestjs): replace with a real GET /market/prices call once the
// backend is wired.
export const MOCK_MARKET_PRICES: MarketPriceEntry[] = [
  { id: "p1", marketNameBn: "যশোর বাজার", district: "jashore", cropType: "rice", pricePerMon: 1180, trend: "up", changePercent: 6 },
  { id: "p2", marketNameBn: "বগুড়া বাজার", district: "bogura", cropType: "rice", pricePerMon: 1120, trend: "flat", changePercent: 0 },
  { id: "p3", marketNameBn: "রংপুর বাজার", district: "rangpur", cropType: "rice", pricePerMon: 1095, trend: "down", changePercent: 3 },
  { id: "p4", marketNameBn: "মুন্সিগঞ্জ বাজার", district: "munshiganj", cropType: "potato", pricePerMon: 640, trend: "up", changePercent: 12 },
  { id: "p5", marketNameBn: "কুমিল্লা বাজার", district: "comilla", cropType: "potato", pricePerMon: 590, trend: "down", changePercent: 4 },
  { id: "p6", marketNameBn: "বগুড়া বাজার", district: "bogura", cropType: "tomato", pricePerMon: 980, trend: "up", changePercent: 9 },
  { id: "p7", marketNameBn: "যশোর বাজার", district: "jashore", cropType: "tomato", pricePerMon: 910, trend: "flat", changePercent: 0 },
  { id: "p8", marketNameBn: "কুমিল্লা বাজার", district: "comilla", cropType: "vegetable", pricePerMon: 720, trend: "up", changePercent: 7 },
  { id: "p9", marketNameBn: "রংপুর বাজার", district: "rangpur", cropType: "onion", pricePerMon: 1450, trend: "up", changePercent: 15 },
  { id: "p10", marketNameBn: "মুন্সিগঞ্জ বাজার", district: "munshiganj", cropType: "onion", pricePerMon: 1380, trend: "down", changePercent: 5 },
  { id: "p11", marketNameBn: "বগুড়া বাজার", district: "bogura", cropType: "corn", pricePerMon: 860, trend: "flat", changePercent: 0 },
  { id: "p12", marketNameBn: "রংপুর বাজার", district: "rangpur", cropType: "corn", pricePerMon: 905, trend: "up", changePercent: 8 },
  { id: "p13", marketNameBn: "যশোর বাজার", district: "jashore", cropType: "lentil", pricePerMon: 2150, trend: "down", changePercent: 2 },
  { id: "p14", marketNameBn: "কুমিল্লা বাজার", district: "comilla", cropType: "lentil", pricePerMon: 2260, trend: "up", changePercent: 4 },
];

// TODO(nestjs): replace with a real GET /market/listings call once the
// backend is wired.
export const MOCK_MARKET_LISTINGS: MarketListing[] = [
  {
    id: "l1",
    cropType: "potato",
    cropNameBn: "আলু",
    quantityBn: "৫০০ কেজি",
    askingPriceBn: "৳ ৩০/কেজি",
    askingPricePerKg: 30,
    district: "munshiganj",
    sellerNameBn: "করিম মিয়া",
  },
  {
    id: "l2",
    cropType: "tomato",
    cropNameBn: "টমেটো",
    quantityBn: "২০০ কেজি",
    askingPriceBn: "৳ ৫০/কেজি",
    askingPricePerKg: 50,
    district: "bogura",
    sellerNameBn: "রহিমা বেগম",
  },
  {
    id: "l3",
    cropType: "rice",
    cropNameBn: "ধান (আমন)",
    quantityBn: "১ টন",
    askingPriceBn: "৳ ৪৮/কেজি",
    askingPricePerKg: 48,
    district: "jashore",
    sellerNameBn: "আব্দুল হক",
  },
  {
    id: "l4",
    cropType: "vegetable",
    cropNameBn: "মিশ্র সবজি",
    quantityBn: "১৫০ কেজি",
    askingPriceBn: "৳ ৪০/কেজি",
    askingPricePerKg: 40,
    district: "comilla",
    sellerNameBn: "সালমা খাতুন",
  },
  {
    id: "l5",
    cropType: "onion",
    cropNameBn: "পেঁয়াজ",
    quantityBn: "৩০০ কেজি",
    askingPriceBn: "৳ ১৪/কেজি",
    askingPricePerKg: 14,
    district: "rangpur",
    sellerNameBn: "নুরুল ইসলাম",
  },
  {
    id: "l6",
    cropType: "corn",
    cropNameBn: "ভুট্টা",
    quantityBn: "৪০০ কেজি",
    askingPriceBn: "৳ ৯/কেজি",
    askingPricePerKg: 9,
    district: "bogura",
    sellerNameBn: "জামাল উদ্দিন",
  },
  {
    id: "l7",
    cropType: "lentil",
    cropNameBn: "মসুর ডাল",
    quantityBn: "১০০ কেজি",
    askingPriceBn: "৳ ২২/কেজি",
    askingPricePerKg: 22,
    district: "jashore",
    sellerNameBn: "ফরিদা বেগম",
  },
  {
    id: "l8",
    cropType: "rice",
    cropNameBn: "ধান (বোরো)",
    quantityBn: "৮০০ কেজি",
    askingPriceBn: "৳ ৪৪/কেজি",
    askingPricePerKg: 44,
    district: "rangpur",
    sellerNameBn: "রফিক আহমেদ",
  },
];

// TODO(nestjs / product): the heat map's real data source (disease-report
// aggregation vs. price-index aggregation) is still an open product
// question — these intensities are placeholder mock values only, not
// derived from any real reporting pipeline yet.
export const MOCK_HEATMAP_REGIONS: HeatMapRegion[] = [
  { id: "h1", district: "jashore", diseaseIntensity: 0.72, priceIntensity: 0.55 },
  { id: "h2", district: "munshiganj", diseaseIntensity: 0.28, priceIntensity: 0.8 },
  { id: "h3", district: "bogura", diseaseIntensity: 0.45, priceIntensity: 0.4 },
  { id: "h4", district: "rangpur", diseaseIntensity: 0.15, priceIntensity: 0.3 },
  { id: "h5", district: "comilla", diseaseIntensity: 0.62, priceIntensity: 0.65 },
];
