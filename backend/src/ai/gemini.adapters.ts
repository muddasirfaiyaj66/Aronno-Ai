import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { GeminiClient } from './gemini.client';
import { ApiError, Errors } from '../common/errors';
import { formatTakaBn, parseTaka } from '../common/bn-digits';
import type {
  AiReceiptPort,
  AiToolsPort,
  AiTreatmentPort,
  AiVisionPort,
  ReceiptResult,
  ToolResult,
  TreatmentResult,
  VisionInput,
  VisionResult,
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

/** Accepts 1200, "1200", "১,২০০", "৳ 1,200/-" — Gemini mixes scripts. */
const taka = z.preprocess(parseTaka, z.number().nonnegative());

const receiptSchema = z.object({
  totalBdt: taka,
  summaryBn: bn.min(2),
  items: z
    .array(
      z
        .object({
          nameBn: bn.min(1),
          quantity: z.string().trim().default(''),
          priceBn: z.string().trim().default(''),
          priceBdt: taka.optional(),
        })
        .transform((item) => {
          const priceBdt = item.priceBdt ?? parseTaka(item.priceBn);
          return {
            nameBn: item.nameBn,
            quantity: item.quantity || '—',
            priceBdt,
            priceBn:
              item.priceBn ||
              (priceBdt > 0 ? `৳ ${formatTakaBn(priceBdt)}` : 'অস্পষ্ট'),
          };
        }),
    )
    .min(1)
    .max(24),
});

/**
 * Cloudinary delivery transform for faded / low-contrast receipts: cap size,
 * force JPEG, auto-contrast and sharpen. EXIF rotation is applied by default.
 */
const RECEIPT_TRANSFORM = 'c_limit,w_2000,f_jpg/e_auto_contrast/e_sharpen:60';

export function enhancedReceiptUrl(imageUrl: string): string | null {
  const marker = '/image/upload/';
  if (!/^https:\/\/res\.cloudinary\.com\//.test(imageUrl)) return null;
  const at = imageUrl.indexOf(marker);
  if (at < 0) return null;
  const head = imageUrl.slice(0, at + marker.length);
  return `${head}${RECEIPT_TRANSFORM}/${imageUrl.slice(at + marker.length)}`;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length >= 80 && buf.length <= 4_000_000 ? buf : null;
  } catch {
    return null;
  }
}

const RECEIPT_PROMPT = `You are reading a photo of a Bangladeshi shop / agro-input receipt (cash memo). It may be printed or handwritten, in Bangla, English or both. Read it slowly, line by line.

Bangla numerals: ০=0 ১=1 ২=2 ৩=3 ৪=4 ৫=5 ৬=6 ৭=7 ৮=8 ৯=9.
Check every digit: ৪ is FOUR even though it looks like the Latin 8; ৭ is SEVEN even though it looks like 9; ০ is zero, not the letter o. Do not mix Bangla and Latin digits inside one number.
"৳", "Tk", "টাকা" and a trailing "/-" all mark taka. Commas are thousand separators.

For each purchased line item return:
- nameBn: product name in Bangla (write English brand names in Bangla script, e.g. "Urea" → "ইউরিয়া")
- quantity: exactly as written, with Bangla digits (e.g. "২ কেজি", "১ বোতল")
- priceBdt: the line amount in taka as a plain number with ASCII digits (e.g. 1200). If only unit price × quantity is shown, multiply.
- priceBn: the same amount written like "৳ ১,২০০"
If an amount cannot be read with confidence, set priceBdt to 0 and priceBn to "অস্পষ্ট" — never guess.
Ignore shop name, address, phone numbers, dates and memo numbers.
totalBdt: the printed grand total as an ASCII-digit number; if none is printed, the sum of priceBdt.
summaryBn: one short Bangla sentence with the total and the biggest cost.

JSON only:
{"totalBdt":3200,"summaryBn":"মোট ৩,২০০ টাকা খরচ হয়েছে। সবচেয়ে বেশি খরচ ইউরিয়া সারে।","items":[{"nameBn":"ইউরিয়া সার","quantity":"২ ব্যাগ","priceBdt":2000,"priceBn":"৳ ২,০০০"}]}`;

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
      const enhancedUrl = input.imageUrl
        ? enhancedReceiptUrl(input.imageUrl)
        : null;
      const enhanced = enhancedUrl ? await fetchImage(enhancedUrl) : null;
      const raw = await this.gemini.generateJson<unknown>(
        RECEIPT_PROMPT,
        enhanced
          ? { imageBuffer: enhanced }
          : { imageUrl: input.imageUrl, imageBuffer: input.imageBuffer },
      );
      const parsed = receiptSchema.parse(raw);
      const summed = parsed.items.reduce((acc, item) => acc + item.priceBdt, 0);
      const totalBdt = Math.round(
        parsed.totalBdt > 0 ? parsed.totalBdt : summed,
      );
      return { ...parsed, totalBdt };
    } catch (err) {
      failAi(this.logger, 'Receipt', err);
    }
  }
}
