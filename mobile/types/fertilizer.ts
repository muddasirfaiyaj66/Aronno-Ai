export type GrowthStage = "seedling" | "vegetative" | "flowering" | "maturity";
export type SoilColor = "dark" | "medium" | "light";
export type SoilMoisture = "wet" | "moist" | "dry";

export type FertilizerAdvice = {
  fertilizerNameBn: string;
  dosagePerBigha: string;
  applicationMethodBn: string;
  timingBn: string;
  /** Shown as a warning callout when present, e.g. over-use risk. */
  warningBn?: string;
};
