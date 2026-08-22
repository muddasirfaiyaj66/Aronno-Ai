import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type MonthForecast = {
  month: string;
  weatherIcon: IconName;
  recommendedCropBn: string;
  tempC?: number;
  precipMm?: number;
};

export type CropPlan = {
  months: MonthForecast[];
  /** 3-4 sentence AI-generated cultivation recommendation. */
  recommendationBn: string;
};
