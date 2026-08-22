import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Always the free Flash-Lite family — never Pro. */
const FREE_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export function resolveFreeGeminiModel(raw?: string | null): string {
  const id = raw?.trim() ?? '';
  if (id && /flash-lite/i.test(id) && !/pro/i.test(id)) return id;
  return FREE_GEMINI_MODEL;
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
    }
  }

  isEnabled() {
    return this.apiKey.length > 8;
  }

  async generateJson<T>(
    prompt: string,
    opts?: { imageUrl?: string; imageBuffer?: Buffer },
  ): Promise<T> {
    if (!this.isEnabled()) throw new Error('GEMINI_API_KEY missing');

    const parts: GeminiPart[] = [{ text: prompt }];
    const image = await this.imagePart(opts?.imageUrl, opts?.imageBuffer);
    if (image) parts.unshift(image);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      this.logger.warn(`Gemini ${this.model} HTTP ${res.status}`);
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    let payload: {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      throw new Error('Gemini response was not JSON');
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
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
