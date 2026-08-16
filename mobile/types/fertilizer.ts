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

// TODO(nestjs): replace with a real fertilizer-recommendation call keyed by
// crop type, growth stage, and soil colour/moisture.
export const MOCK_FERTILIZER_ADVICE: FertilizerAdvice = {
  fertilizerNameBn: "ইউরিয়া ও টিএসপি মিশ্রণ",
  dosagePerBigha: "১৫ কেজি ইউরিয়া + ১০ কেজি টিএসপি প্রতি বিঘা",
  applicationMethodBn: "মাটির সাথে সমানভাবে মিশিয়ে সারিতে প্রয়োগ করুন।",
  timingBn: "রোপণের ১৫–২০ দিন পর সকালে প্রয়োগ করুন।",
  warningBn:
    "অতিরিক্ত ইউরিয়া প্রয়োগ করলে গাছের ক্ষতি হতে পারে — নির্ধারিত মাত্রা মেনে চলুন।",
};
