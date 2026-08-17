import type { YieldTrend } from "./history";

export type YieldEstimate = {
  cropNameBn: string;
  landSizeBn: string;
  weatherSummaryBn: string;
  /** মণ (mon) */
  estimatedMinMon: number;
  estimatedMaxMon: number;
  lastSeasonMon: number;
  trend: YieldTrend;
  changePercent: number;
};

// TODO(nestjs): replace with a real yield-prediction call using the
// farmer's crop type, land size, and live weather data.
export const MOCK_YIELD_ESTIMATE: YieldEstimate = {
  cropNameBn: "ধান (আমন)",
  landSizeBn: "২ বিঘা",
  weatherSummaryBn: "স্বাভাবিক বৃষ্টিপাত প্রত্যাশিত",
  estimatedMinMon: 32,
  estimatedMaxMon: 38,
  lastSeasonMon: 30,
  trend: "up",
  changePercent: 15,
};
