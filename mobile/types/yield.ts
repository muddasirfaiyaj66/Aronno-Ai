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
