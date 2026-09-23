export type GrowthStage = "seedling" | "vegetative" | "flowering" | "maturity";
export type SoilColor = "dark" | "medium" | "light";
export type SoilMoisture = "wet" | "moist" | "dry";
export type DiseaseStatus = "yes" | "no" | "unsure";

export type FertilizerAdvice = {
  fertilizerNameBn: string;
  dosagePerBigha: string;
  applicationMethodBn: string;
  timingBn: string;
  /** Shown as a warning callout when present, e.g. over-use risk. */
  warningBn?: string;
  /** Why this recommendation — which inputs changed the dose. */
  reasonBn?: string;
  landSizeBigha?: number;
  cropAgeDays?: number;
  hasDisease?: DiseaseStatus;
  /** Linked from the farmer's latest diagnosis in History. */
  diseaseNameBn?: string;
};
