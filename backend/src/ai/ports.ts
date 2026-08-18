import type { Severity, SprayLevel, YieldTrend } from '@prisma/client';

export type VisionInput = { imageBuffer?: Buffer; transcriptBn?: string };

export type VisionResult = {
  diseaseNameBn: string;
  diseaseNameEn: string;
  confidence: number;
  severity: Severity;
};

export interface AiVisionPort {
  diagnose(input: VisionInput): Promise<VisionResult>;
}

export type TreatmentResult = {
  pesticideNameBn: string;
  dosagePerBigha: string;
  followUpLabelBn: string;
  steps: { step: number; instructionBn: string }[];
  safety: string[];
};

export interface AiTreatmentPort {
  plan(diseaseNameBn: string, severity: Severity): Promise<TreatmentResult>;
}

export type ToolResult = {
  toolNameBn: string;
  toolNameEn: string;
  reasonBn: string;
  listings: {
    sourceName: string;
    thumbnailUrl: string;
    priceBn?: string;
    externalUrl: string;
  }[];
};

export interface AiToolsPort {
  identify(input: VisionInput): Promise<ToolResult>;
}

export type ReceiptResult = {
  totalBdt: number;
  summaryBn: string;
  items: { nameBn: string; quantity: string; priceBn: string }[];
};

export interface AiReceiptPort {
  scan(imageBuffer: Buffer): Promise<ReceiptResult>;
}

export type FertilizerResult = {
  fertilizerNameBn: string;
  dosagePerBigha: string;
  applicationMethodBn: string;
  timingBn: string;
  warningBn?: string;
};

export interface AiFertilizerPort {
  recommend(input: {
    cropSlug: string;
    growthStage: string;
    soilColor: string;
    soilMoisture: string;
  }): Promise<FertilizerResult>;
}

export type YieldResult = {
  landSizeBn: string;
  weatherSummaryBn: string;
  estimatedMinMon: number;
  estimatedMaxMon: number;
  lastSeasonMon: number;
  trend: YieldTrend;
  changePercent: number;
};

export interface AiYieldPort {
  predict(cropSlug: string): Promise<YieldResult>;
}

export type PlanResult = {
  recommendationBn: string;
  months: { monthBn: string; weatherIcon: string; recommendedCropBn: string }[];
};

export interface AiPlanningPort {
  generate(): Promise<PlanResult>;
}

export interface TtsPort {
  synthesize(textBn: string): Promise<Buffer>;
}

export interface WeatherPort {
  sprayAdvisory(): Promise<{ level: SprayLevel; reasonBn: string }>;
  summaryBn(): Promise<string>;
}

export interface CostEstimatePort {
  estimate(landSize: number, landUnit: 'bigha' | 'acre'): {
    pesticideQuantity: string;
    totalCostBdt: number;
    spraySessions: number;
  };
}
