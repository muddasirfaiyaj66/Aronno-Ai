import { Inject, Injectable } from '@nestjs/common';
import type { Diagnosis } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AI_VISION } from '../ai/ai.tokens';
import type { AiVisionPort } from '../ai/ports';
import { GeminiClient } from '../ai/gemini.client';
import { StorageService } from '../storage/storage.service';
import { Errors } from '../common/errors';
import { resolveDiagnosisLocation, type Geo } from './diagnosis-location';
import type { AuthUser } from '../auth/auth.types';

const transcriptSchema = z.object({ transcriptBn: z.string().trim() });

@Injectable()
export class DiagnosesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(AI_VISION) private readonly vision: AiVisionPort,
    private readonly gemini: GeminiClient,
  ) {}

  private dto(row: {
    id: string;
    diseaseNameBn: string;
    diseaseNameEn: string;
    confidence: number;
    severity: string;
    imageObjectKey: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      diseaseNameBn: row.diseaseNameBn,
      diseaseNameEn: row.diseaseNameEn,
      confidence: row.confidence,
      severity: row.severity,
      imageUrl: row.imageObjectKey
        ? this.storage.urlFor(row.imageObjectKey)
        : '',
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createPhoto(user: AuthUser, imageUrl: string, geo: Geo = {}) {
    const ai = await this.vision.diagnose({ imageUrl });
    return this.persist(user.id, geo, {
      source: 'photo',
      imageObjectKey: imageUrl,
      ...ai,
    });
  }

  async transcribe(audioBase64: string, mimeType?: string) {
    const buf = Buffer.from(audioBase64, 'base64');
    if (buf.length < 80 || buf.length > 4_000_000)
      throw Errors.validation({ audio: 'invalid' });
    const prompt = `Transcribe this farmer speaking. Prefer Bangla (bn-BD).
Return JSON only: {"transcriptBn":"..."}
If the clip is silent or unintelligible, return {"transcriptBn":""}.`;
    try {
      const raw = await this.gemini.generateJson<unknown>(prompt, {
        audioBuffer: buf,
        audioMime: mimeType,
      });
      return transcriptSchema.parse(raw);
    } catch (first) {
      try {
        const raw = await this.gemini.generateJson<unknown>(prompt, {
          audioBuffer: buf,
          audioMime: mimeType,
          jsonMode: false,
        });
        const parsed = transcriptSchema.safeParse(raw);
        if (parsed.success) return parsed.data;
        if (typeof raw === 'string') return { transcriptBn: raw.trim() };
      } catch {
        // keep original error
      }
      throw first;
    }
  }

  async createVoice(
    user: AuthUser,
    transcriptBn: string,
    cropSlug?: string,
    geo: Geo = {},
  ) {
    const crop = cropSlug
      ? await this.prisma.crop.findUnique({ where: { slug: cropSlug } })
      : null;
    const ai = await this.vision.diagnose({ transcriptBn });
    return this.persist(user.id, geo, {
      source: 'voice',
      transcriptBn,
      cropId: crop?.id,
      ...ai,
    });
  }

  private async persist(
    userId: string,
    geo: Geo,
    data: {
      source: 'photo' | 'voice';
      imageObjectKey?: string;
      transcriptBn?: string;
      cropId?: string;
      diseaseNameBn: string;
      diseaseNameEn: string;
      confidence: number;
      severity: 'low' | 'medium' | 'high';
    },
  ) {
    const location = await resolveDiagnosisLocation(this.prisma, userId, geo);
    const row = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.diagnosis.create({
        data: {
          userId,
          ...location,
          source: data.source,
          imageObjectKey: data.imageObjectKey,
          transcriptBn: data.transcriptBn,
          cropId: data.cropId,
          diseaseNameBn: data.diseaseNameBn,
          diseaseNameEn: data.diseaseNameEn,
          confidence: data.confidence,
          severity: data.severity,
        },
      });
      await tx.historyEvent.create({
        data: { userId, kind: 'disease', sourceId: created.id },
      });
      return created;
    });
    return this.dto(row);
  }

  async get(user: AuthUser, id: string) {
    const row = await this.prisma.diagnosis.findUnique({ where: { id } });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    return this.dto(row);
  }

  async list(user: AuthUser, cursor?: string, limit = 20) {
    const rows: Diagnosis[] = await this.prisma.diagnosis.findMany({
      where: user.role === 'USER' ? { userId: user.id } : undefined,
      take: Math.min(limit, 50),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.dto(r));
  }
}
