import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { CropType, CultivationCost } from "./treatment";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type MonthForecast = {
  month: string;
  weatherIcon: IconName;
  recommendedCropBn: string;
  tempC?: number;
  precipMm?: number;
  /** Priority crop for this month (matches the cost table). */
  cropSlug?: CropType;
  plantingWindowBn?: string;
  harvestWindowBn?: string;
  /** Why this crop, citing the month's forecast. */
  reasonBn?: string;
};

export type CropPlan = {
  months: MonthForecast[];
  /** AI-generated cultivation recommendation tied to the months above. */
  recommendationBn: string;
  /** Cultivation cost for the first priority crop. */
  costEstimate?: CultivationCost;
  /** Present right after generation. */
  outlookSource?: "seasonal" | "climatology";
};

export type CropSeason = "rabi" | "kharif1" | "kharif2";
export type LandType = "high" | "medium" | "low";
export type FarmGoal = "profit" | "low_cost" | "food" | "low_risk";

/** What the farmer tells the advisor about their land. */
export type FarmAdviceInput = {
  landSize: number;
  landUnit: "bigha" | "acre";
  landType?: LandType;
  pastCrops: { nameBn: string; season?: CropSeason }[];
  wantedCrops: string[];
  goal?: FarmGoal;
  lat?: number;
  lon?: number;
};

export type AdvisedCrop = {
  nameBn: string;
  cropSlug?: CropType;
  /** 0–100 fit for this farmer. */
  score: number;
  fitBn: string;
  rotationBn: string;
  riskBn: string;
  sowBn: string;
  harvestBn: string;
  /** The farmer asked for this crop. */
  wanted: boolean;
  cost?: CultivationCost;
};

export type WantedVerdict = "good" | "risky" | "not_now";

export type FarmAdvice = {
  id: string;
  createdAt: string;
  summaryBn: string;
  topCrops: AdvisedCrop[];
  wantedCheck: { nameBn: string; verdict: WantedVerdict; reasonBn: string }[];
  timeline: { monthBn: string; activityBn: string }[];
  months: MonthForecast[];
  locationBn: string;
  outlookSource: "seasonal" | "climatology";
  generatedBy: "ai" | "rules";
  /** Saved answers, only on the latest-advice read. */
  input?: Omit<FarmAdviceInput, "lat" | "lon">;
};
