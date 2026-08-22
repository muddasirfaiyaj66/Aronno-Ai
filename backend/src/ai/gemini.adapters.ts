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

const bn = z.string().trim().min(1);

const confidenceSchema = z.preprocess((value) => {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1) {
    return Math.round(n * 100);
  }
  return n;
}, z.number().min(0).max(100));

const severitySchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const s = value.trim().toLowerCase();
    if (s === 'low' || s === 'mild' || s === 'minor') return 'low';
    if (s === 'medium' || s === 'moderate' || s === 'mid') return 'medium';
    if (s === 'high' || s === 'severe' || s === 'critical') return 'high';
    return s;
  },
  z.enum(['low', 'medium', 'high']),
);

const num = z.coerce.number();

const visionSchema = z.object({
  diseaseNameBn: bn.min(2),
  diseaseNameEn: bn.min(2),
  confidence: confidenceSchema,
  severity: severitySchema,
});

const treatmentSchema = z.object({
  pesticideNameBn: bn.min(2),
  dosagePerBigha: bn.min(1),
  followUpLabelBn: bn.min(1),
  steps: z
    .array(z.object({ step: z.coerce.number(), instructionBn: bn.min(2) }))
    .min(1)
    .max(8),
  safety: z.array(bn.min(2)).min(1).max(8),
});

const httpUrl = z.preprocess((value) => {
  if (typeof value !== 'string' || !value.trim())
    return 'https://www.daraz.com.bd/';
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().min(8));

const listingThumb = z.preprocess((value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}, z.string());

const toolsSchema = z.object({
  toolNameBn: bn.min(2),
  toolNameEn: bn.min(2),
  reasonBn: bn.min(2),
  listings: z
    .array(
      z.object({
        sourceName: bn.min(1),
        thumbnailUrl: listingThumb.optional().default(''),
        priceBn: z.string().optional(),
        externalUrl: httpUrl,
      }),
    )
    .max(4)
    .default([]),
});

const receiptSchema = z.object({
  totalBdt: z.coerce.number().nonnegative(),
  summaryBn: bn.min(2),
  items: z
    .array(
      z.object({
        nameBn: bn.min(1),
        quantity: bn.min(1),
        priceBn: bn.min(1),
      }),
    )
    .min(1)
    .max(16),
});

const fertilizerSchema = z.object({
  fertilizerNameBn: bn.min(2),
  dosagePerBigha: bn.min(1),
  applicationMethodBn: bn.min(2),
  timingBn: bn.min(1),
  warningBn: z.string().optional(),
});

const yieldSchema = z.object({
  landSizeBn: bn.min(1),
  weatherSummaryBn: bn.min(2),
  estimatedMinMon: num,
  estimatedMaxMon: num,
  lastSeasonMon: num,
  trend: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const s = value.trim().toLowerCase();
      if (s === 'up' || s === 'increase' || s === 'rising') return 'up';
      if (s === 'down' || s === 'decrease' || s === 'falling') return 'down';
      if (s === 'flat' || s === 'same' || s === 'stable') return 'flat';
      return s;
    },
    z.enum(['up', 'down', 'flat']),
  ),
  changePercent: num,
});

function shopListings(toolNameEn: string): ToolResult['listings'] {
  const q = encodeURIComponent(toolNameEn);
  return [
    {
      sourceName: 'দারাজ',
      thumbnailUrl: '',
      priceBn: 'অনলাইনে দেখুন',
      externalUrl: `https://www.daraz.com.bd/catalog/?q=${q}`,
    },
    {
      sourceName: 'গুগল শপিং',
      thumbnailUrl: '',
      priceBn: 'দাম তুলনা',
      externalUrl: `https://www.google.com/search?tbm=shop&q=${q}+bangladesh`,
    },
    {
      sourceName: 'স্থানীয় দোকান',
      thumbnailUrl: '',
      priceBn: 'কাছাকাছি খুঁজুন',
      externalUrl: `https://www.google.com/search?q=${q}+কৃষি+যন্ত্র+বাংলাদেশ`,
    },
  ];
}

function takaFromPrice(priceBn: string): number {
  const digits = priceBn.replace(/[^\d.]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

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
Confidence is an integer 0-100, not a fraction. Severity must be exactly low, medium, or high.
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

  async plan(
    diseaseNameBn: string,
    severity: 'low' | 'medium' | 'high',
  ): Promise<TreatmentResult> {
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
        `You are a Bangladesh farm-tool expert. Identify ONE tool from the photo and/or Bangla task.
Task: ${input.transcriptBn ?? '(photo of a tool or field task)'}
Prefer tools actually sold in Bangladesh (power tiller, sprayer, weeder, sickle, pump, thresher).
Return JSON only:
{"toolNameBn":"...","toolNameEn":"...","reasonBn":"2-3 short Bangla sentences why this tool fits","listings":[{"sourceName":"দারাজ","thumbnailUrl":"","priceBn":"৳ ...","externalUrl":"https://www.daraz.com.bd/catalog/?q=..."}]}
Give 2-3 listings with real https search URLs on daraz.com.bd or google.com. If unsure of price, use "দাম দেখুন".`,
        { imageUrl: input.imageUrl, imageBuffer: input.imageBuffer },
      );
      const parsed = toolsSchema.parse(raw);
      const listings =
        parsed.listings.length >= 1
          ? parsed.listings
          : shopListings(parsed.toolNameEn);
      return { ...parsed, listings };
    } catch (err) {
      failAi(this.logger, 'Tools', err);
    }
  }
}

@Injectable()
export class GeminiReceiptAdapter implements AiReceiptPort {
  private readonly logger = new Logger(GeminiReceiptAdapter.name);
  constructor(private readonly gemini: GeminiClient) {}

  async scan(input: {
    imageUrl?: string;
    imageBuffer?: Buffer;
  }): Promise<ReceiptResult> {
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Read this Bangladeshi shop/agro receipt (Bangla or English handwriting or print).
Extract every line item. Quantities like "২ কেজি" or "1 pcs". Prices in BDT.
JSON only:
{"totalBdt":3200,"summaryBn":"মোট ৩২০০ টাকা খরচ হয়েছে। প্রধান খরচ: ...","items":[{"nameBn":"...","quantity":"...","priceBn":"৳ 1200"}]}
totalBdt must be a number (not a string). If the printed total is missing, sum the line items.`,
        { imageUrl: input.imageUrl, imageBuffer: input.imageBuffer },
      );
      const parsed = receiptSchema.parse(raw);
      const summed = parsed.items.reduce(
        (acc, item) => acc + takaFromPrice(item.priceBn),
        0,
      );
      const totalBdt = parsed.totalBdt > 0 ? parsed.totalBdt : summed;
      return { ...parsed, totalBdt };
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
