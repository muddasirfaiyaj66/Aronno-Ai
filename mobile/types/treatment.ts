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

export type CropType = "rice" | "potato" | "tomato" | "vegetable";
export type LandUnit = "bigha" | "acre";

export type CostEstimateInput = {
  cropType: CropType;
  landSize: number;
  landUnit: LandUnit;
};

export type CostEstimateResult = {
  pesticideQuantity: string;
  totalCostBdt: number;
  spraySessions: number;
};
