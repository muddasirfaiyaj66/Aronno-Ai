export type SprayAdvisoryLevel = "safe" | "caution" | "wait";

export type WeatherAdvisory = {
  level: SprayAdvisoryLevel;
  reasonBn: string;
};

export type TreatmentStep = {
  step: number;
  instructionBn: string;
};

export type SafetyChecklistItem = {
  id: string;
  labelBn: string;
};

export type TreatmentPlan = {
  id?: string;
  cropNameBn: string;
  diseaseNameBn: string;
  pesticideNameBn: string;
  /** e.g. "৫০ মিলি/বিঘা" */
  dosagePerBigha: string;
  steps: TreatmentStep[];
  safetyChecklist: SafetyChecklistItem[];
  /** e.g. "৭ দিন পর আবার দেখুন" */
  followUpLabelBn: string;
  weatherAdvisory: WeatherAdvisory;
};

export type CropType =
  | "rice"
  | "potato"
  | "tomato"
  | "vegetable"
  | "onion"
  | "mustard"
  | "lentil"
  | "corn";
export type LandUnit = "bigha" | "acre";

export type CostEstimateInput = {
  cropType: CropType;
  landSize: number;
  landUnit: LandUnit;
};

export type CultivationCostItem = {
  labelBn: string;
  quantityBn: string;
  costBdt: number;
};

/** Full input cost (seed, fertilizer, labour, …) for a crop on given land. */
export type CultivationCost = {
  cropSlug: CropType;
  cropNameBn: string;
  landSizeBigha: number;
  items: CultivationCostItem[];
  totalBdt: number;
};

export type CostEstimateResult = {
  /** Spray-only figures. */
  pesticideQuantity: string;
  totalCostBdt: number;
  spraySessions: number;
  cultivation?: CultivationCost;
};
