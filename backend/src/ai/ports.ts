import type { Severity, YieldTrend } from '@prisma/client';

export type VisionInput = {
  imageBuffer?: Buffer;
  imageUrl?: string;
  transcriptBn?: string;
};

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
  scan(input: {
    imageUrl?: string;
    imageBuffer?: Buffer;
  }): Promise<ReceiptResult>;
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
    landSizeBigha: number;
    cropAgeDays: number;
    hasDisease: 'yes' | 'no' | 'unsure';
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

export interface TtsPort {
  synthesize(textBn: string): Promise<Buffer>;
}

export type { WeatherPort } from '../weather/weather.types';

export interface CostEstimatePort {
  estimate(
    landSize: number,
    landUnit: 'bigha' | 'acre',
  ): {
    pesticideQuantity: string;
    totalCostBdt: number;
    spraySessions: number;
  };
}
