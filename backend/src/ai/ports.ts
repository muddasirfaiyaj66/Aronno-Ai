import type { Severity } from '@prisma/client';
import type { CostCropSlug, CultivationCost } from '../cost/cultivation-costs';

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
  items: {
    nameBn: string;
    quantity: string;
    priceBn: string;
    /** Line amount in taka (0 when the model marked it unreadable). */
    priceBdt: number;
  }[];
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
  /** Why these numbers — which inputs moved the dose. */
  reasonBn: string;
};

export type FertilizerInput = {
  cropSlug: string;
  growthStage: 'seedling' | 'vegetative' | 'flowering' | 'maturity';
  soilColor: 'dark' | 'medium' | 'light';
  soilMoisture: 'wet' | 'moist' | 'dry';
  landSizeBigha: number;
  cropAgeDays: number;
  hasDisease: 'yes' | 'no' | 'unsure';
  /** From the farmer's latest diagnosis in History, when linked. */
  diseaseNameBn?: string;
  diseaseSeverity?: Severity;
};

export interface AiFertilizerPort {
  recommend(input: FertilizerInput): Promise<FertilizerResult>;
}

export interface TtsPort {
  synthesize(textBn: string): Promise<Buffer>;
}

export type { WeatherPort } from '../weather/weather.types';

export interface CostEstimatePort {
  estimate(
    cropSlug: CostCropSlug,
    landSize: number,
    landUnit: 'bigha' | 'acre',
  ): {
    /** Spray-only figures (used by the treatment → cost flow). */
    pesticideQuantity: string;
    totalCostBdt: number;
    spraySessions: number;
    /** Full input cost for the crop on this land. */
    cultivation: CultivationCost;
  };
}
