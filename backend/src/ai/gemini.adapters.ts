import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { GeminiClient } from './gemini.client';
import { ApiError, Errors } from '../common/errors';
import type {
  AiFertilizerPort,
  AiReceiptPort,
  AiToolsPort,
  AiTreatmentPort,
  AiVisionPort,
  AiYieldPort,
  FertilizerResult,
  ReceiptResult,
  ToolResult,
  TreatmentResult,
  VisionInput,
  VisionResult,
  YieldResult,
} from './ports';

const visionSchema = z.object({
  diseaseNameBn: z.string().min(2),
  diseaseNameEn: z.string().min(2),
  confidence: z.number().min(0).max(100),
  severity: z.enum(['low', 'medium', 'high']),
});

const treatmentSchema = z.object({
  pesticideNameBn: z.string().min(2),
  dosagePerBigha: z.string().min(2),
  followUpLabelBn: z.string().min(2),
  steps: z
    .array(z.object({ step: z.number(), instructionBn: z.string().min(2) }))
    .min(2)
    .max(6),
  safety: z.array(z.string().min(2)).min(2).max(6),
});

const toolsSchema = z.object({
  toolNameBn: z.string().min(2),
  toolNameEn: z.string().min(2),
  reasonBn: z.string().min(2),
  listings: z
    .array(
      z.object({
        sourceName: z.string().min(1),
        thumbnailUrl: z.string().optional().default(''),
        priceBn: z.string().optional(),
        externalUrl: z.string().min(8),
      }),
    )
    .min(1)
    .max(4),
});

const receiptSchema = z.object({
  totalBdt: z.number().nonnegative(),
  summaryBn: z.string().min(2),
  items: z
    .array(
      z.object({
        nameBn: z.string().min(1),
        quantity: z.string().min(1),
        priceBn: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
});

const fertilizerSchema = z.object({
  fertilizerNameBn: z.string().min(2),
  dosagePerBigha: z.string().min(2),
  applicationMethodBn: z.string().min(2),
  timingBn: z.string().min(2),
  warningBn: z.string().optional(),
});

const yieldSchema = z.object({
  landSizeBn: z.string().min(1),
  weatherSummaryBn: z.string().min(2),
  estimatedMinMon: z.number(),
  estimatedMaxMon: z.number(),
  lastSeasonMon: z.number(),
  trend: z.enum(['up', 'down', 'flat']),
  changePercent: z.number(),
});

function failAi(logger: Logger, label: string, err: unknown): never {
  logger.warn(`${label} failed: ${String(err)}`);
  if (err instanceof ApiError) throw err;
  throw Errors.aiUnavailable();
}

@Injectable()
export class GeminiVisionAdapter implements AiVisionPort {
  private readonly logger = new Logger(GeminiVisionAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async diagnose(input: VisionInput): Promise<VisionResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `You are an agronomist for Bangladeshi smallholder farms. Identify crop disease from the photo and/or Bangla description.
Return JSON only:
{"diseaseNameBn":"...","diseaseNameEn":"...","confidence":0-100,"severity":"low"|"medium"|"high"}
Description: ${input.transcriptBn ?? '(photo only)'}
If the leaf looks healthy, say so. Confidence must reflect image quality.`,
        { imageUrl: input.imageUrl, imageBuffer: input.imageBuffer },
      );
      return visionSchema.parse(raw);
    } catch (err) {
      failAi(this.logger, 'Vision', err);
    }
  }
}

@Injectable()
export class GeminiTreatmentAdapter implements AiTreatmentPort {
  private readonly logger = new Logger(GeminiTreatmentAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async plan(diseaseNameBn: string, severity: 'low' | 'medium' | 'high'): Promise<TreatmentResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Write a practical pesticide spray plan for a Bangladeshi farmer.
Disease: ${diseaseNameBn}. Severity: ${severity}.
Use products commonly sold in Bangladesh. Bangla instructions, short sentences.
JSON:
{"pesticideNameBn":"...","dosagePerBigha":"...","followUpLabelBn":"...","steps":[{"step":1,"instructionBn":"..."}],"safety":["..."]}`,
      );
      return treatmentSchema.parse(raw);
    } catch (err) {
      failAi(this.logger, 'Treatment', err);
    }
  }
}

@Injectable()
export class GeminiToolsAdapter implements AiToolsPort {
  private readonly logger = new Logger(GeminiToolsAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async identify(input: VisionInput): Promise<ToolResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Suggest one farm tool sold in Bangladesh for this photo or Bangla task.
Task: ${input.transcriptBn ?? '(photo of a tool or field task)'}
JSON:
{"toolNameBn":"...","toolNameEn":"...","reasonBn":"...","listings":[{"sourceName":"দারাজ","thumbnailUrl":"","priceBn":"৳ ...","externalUrl":"https://www.daraz.com.bd/"}]}`,
        { imageUrl: input.imageUrl, imageBuffer: input.imageBuffer },
      );
      return toolsSchema.parse(raw);
    } catch (err) {
      failAi(this.logger, 'Tools', err);
    }
  }
}

@Injectable()
export class GeminiReceiptAdapter implements AiReceiptPort {
  private readonly logger = new Logger(GeminiReceiptAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async scan(input: { imageUrl?: string; imageBuffer?: Buffer }): Promise<ReceiptResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Read this Bangladeshi shop receipt (Bangla or English). Extract line items and total in BDT.
JSON:
{"totalBdt":3200,"summaryBn":"মোট ... টাকা খরচ হয়েছে।","items":[{"nameBn":"...","quantity":"...","priceBn":"৳ ..."}]}`,
        { imageUrl: input.imageUrl, imageBuffer: input.imageBuffer },
      );
      return receiptSchema.parse(raw);
    } catch (err) {
      failAi(this.logger, 'Receipt', err);
    }
  }
}

@Injectable()
export class GeminiFertilizerAdapter implements AiFertilizerPort {
  private readonly logger = new Logger(GeminiFertilizerAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async recommend(input: {
    cropSlug: string;
    growthStage: string;
    soilColor: string;
    soilMoisture: string;
  }): Promise<FertilizerResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Recommend fertilizer for a Bangladeshi farmer. Crop slug: ${input.cropSlug}. Stage: ${input.growthStage}. Soil colour: ${input.soilColor}. Moisture: ${input.soilMoisture}.
Doses per bigha. Bangla. JSON:
{"fertilizerNameBn":"...","dosagePerBigha":"...","applicationMethodBn":"...","timingBn":"...","warningBn":"..."}`,
      );
      return fertilizerSchema.parse(raw);
    } catch (err) {
      failAi(this.logger, 'Fertilizer', err);
    }
  }
}

@Injectable()
export class GeminiYieldAdapter implements AiYieldPort {
  private readonly logger = new Logger(GeminiYieldAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async predict(cropSlug: string): Promise<YieldResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Estimate rice/aman-style yield in mon for a typical 2 bigha Bangladeshi plot. Crop: ${cropSlug}.
JSON:
{"landSizeBn":"২ বিঘা","weatherSummaryBn":"...","estimatedMinMon":30,"estimatedMaxMon":38,"lastSeasonMon":30,"trend":"up"|"down"|"flat","changePercent":10}`,
      );
      return yieldSchema.parse(raw);
    } catch (err) {
      failAi(this.logger, 'Yield', err);
    }
  }
}
