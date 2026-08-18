import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_VISION } from '../ai/ai.tokens';
import type { AiVisionPort } from '../ai/ports';
import { StorageService } from '../storage/storage.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

@Injectable()
export class DiagnosesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(AI_VISION) private readonly vision: AiVisionPort,
  ) {}

  private dto(
    row: {
      id: string;
      diseaseNameBn: string;
      diseaseNameEn: string;
      confidence: number;
      severity: string;
      imageObjectKey: string | null;
      createdAt: Date;
    },
  ) {
    return {
      id: row.id,
      diseaseNameBn: row.diseaseNameBn,
      diseaseNameEn: row.diseaseNameEn,
      confidence: row.confidence,
      severity: row.severity,
      imageUrl: row.imageObjectKey ? this.storage.urlFor(row.imageObjectKey) : '',
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createPhoto(user: AuthUser, imageUrl: string) {
    const ai = await this.vision.diagnose({});
    return this.persist(user.id, {
      source: 'photo',
      imageObjectKey: imageUrl,
      ...ai,
    });
  }

  async createVoice(user: AuthUser, transcriptBn: string, cropSlug?: string) {
    const crop = cropSlug
      ? await this.prisma.crop.findUnique({ where: { slug: cropSlug } })
      : null;
    const ai = await this.vision.diagnose({ transcriptBn });
    return this.persist(user.id, {
      source: 'voice',
      transcriptBn,
      cropId: crop?.id,
      ...ai,
    });
  }

  private async persist(
    userId: string,
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
    const row = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.diagnosis.create({
        data: {
          userId,
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
    if (row.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
    return this.dto(row);
  }

  async list(user: AuthUser, cursor?: string, limit = 20) {
    const rows = await this.prisma.diagnosis.findMany({
      where: user.role === 'USER' ? { userId: user.id } : undefined,
      take: Math.min(limit, 50),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.dto(r));
  }
}
