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
