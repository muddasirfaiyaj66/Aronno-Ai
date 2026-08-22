import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors';

/** Free Flash-Lite family only — never Pro. 2.x ids 404 for new Google AI keys. */
const FREE_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
] as const;

const DEFAULT_GEMINI_MODEL = FREE_GEMINI_MODELS[0];

export function isRetiredGeminiModel(id: string): boolean {
  return /gemini-1\.5/i.test(id) || /gemini-2\.(0|5)/i.test(id);
}

export function resolveFreeGeminiModel(raw?: string | null): string {
  const id = raw?.trim() ?? '';
  if (!id || /pro/i.test(id) || isRetiredGeminiModel(id)) return DEFAULT_GEMINI_MODEL;
  if (/flash/i.test(id)) return id;
  return DEFAULT_GEMINI_MODEL;
}

function modelCandidates(preferred: string): string[] {
  return [...new Set([preferred, ...FREE_GEMINI_MODELS])];
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly apiKey: string;
  readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim() ?? '';
    this.model = resolveFreeGeminiModel(this.config.get<string>('GEMINI_MODEL'));
    if (this.isEnabled()) {
      this.logger.log(`Gemini enabled — free model ${this.model} (Pro never used)`);
    } else {
      this.logger.warn('GEMINI_API_KEY missing — AI endpoints will return AI_UNAVAILABLE');
    }
  }

  isEnabled() {
    return this.apiKey.length > 8;
  }

  async generateJson<T>(
    prompt: string,
    opts?: {
      imageUrl?: string;
      imageBuffer?: Buffer;
      audioBuffer?: Buffer;
      audioMime?: string;
      jsonMode?: boolean;
    },
  ): Promise<T> {
    if (!this.isEnabled()) throw Errors.aiUnavailable();

    const parts: GeminiPart[] = [{ text: prompt }];
    if (opts?.audioBuffer && opts.audioBuffer.length > 0) {
      if (opts.audioBuffer.length > 4_000_000) throw Errors.aiUnavailable();
      parts.unshift({
        inline_data: {
          mime_type: opts.audioMime?.startsWith('audio/') ? opts.audioMime : 'audio/mp4',
          data: opts.audioBuffer.toString('base64'),
        },
      });
    } else {
      const image = await this.imagePart(opts?.imageUrl, opts?.imageBuffer);
      if (image) parts.unshift(image);
    }

    const jsonMode = opts?.jsonMode !== false;
    let lastStatus = 0;
    for (const model of modelCandidates(this.model)) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });

      const raw = await res.text();
      lastStatus = res.status;
      if (!res.ok) {
        this.logger.warn(`Gemini ${model} HTTP ${res.status}: ${this.redact(raw)}`);
        if (res.status === 404) continue;
        throw Errors.aiUnavailable();
      }

      let payload: {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      };
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        this.logger.warn(`Gemini ${model} returned non-JSON envelope`);
        throw Errors.aiUnavailable();
      }

      const text =
        payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      try {
        return extractJson<T>(text);
      } catch {
        this.logger.warn(
          `Gemini ${model} JSON parse failed (finish=${payload.candidates?.[0]?.finishReason ?? '?'})`,
        );
        throw Errors.aiUnavailable();
      }
    }

    this.logger.warn(`Gemini all free models failed (last HTTP ${lastStatus})`);
    throw Errors.aiUnavailable();
  }

  private redact(text: string) {
    return text.replaceAll(this.apiKey, '[redacted]').replace(/[A-Za-z0-9_-]{24,}/g, '[id]').slice(0, 220);
  }

  private async imagePart(
    imageUrl?: string,
    imageBuffer?: Buffer,
  ): Promise<GeminiPart | null> {
    if (imageBuffer && imageBuffer.length > 0) {
      return {
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageBuffer.toString('base64'),
        },
      };
    }
    if (!imageUrl?.startsWith('http')) return null;
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 80 || buf.length > 4_000_000) return null;
      const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      return {
        inline_data: {
          mime_type: mime.startsWith('image/') ? mime : 'image/jpeg',
          data: buf.toString('base64'),
        },
      };
    } catch (err) {
      this.logger.warn(`Gemini image fetch failed: ${String(err)}`);
      return null;
    }
  }
}

export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error('no json');
  }
}
