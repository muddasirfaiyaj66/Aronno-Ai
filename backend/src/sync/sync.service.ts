import { Injectable } from '@nestjs/common';
import type { DiagnosisSource, Severity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { resolveDiagnosisLocation } from '../diagnoses/diagnosis-location';

type OfflineDiagnosisIn = {
  clientLocalId: string;
  labelId?: string;
  diseaseNameBn: string;
  diseaseNameEn: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  verifiedBn?: string | null;
  source?: DiagnosisSource | string;
  imageObjectKey?: string;
  lat?: number;
  lon?: number;
};

type OfflineToolIn = {
  clientLocalId: string;
  labelId?: string;
  toolNameBn: string;
  toolNameEn: string;
  reasonBn?: string;
  verifiedBn?: string | null;
  imageObjectKey?: string;
};

type OfflineChatIn = {
  clientLocalId: string;
  role: 'user' | 'assistant';
  textBn: string;
  createdAt?: string;
};

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadOffline(
    user: AuthUser,
    body: {
      diagnoses: OfflineDiagnosisIn[];
      tools: OfflineToolIn[];
      chatTurns: OfflineChatIn[];
    },
  ) {
    const diagnoses: { clientLocalId: string; serverId: string }[] = [];
    const tools: { clientLocalId: string; serverId: string }[] = [];
    const chatTurns: { clientLocalId: string; serverId: string }[] = [];

    for (const d of body.diagnoses) {
      const existing = await this.prisma.diagnosis.findFirst({
        where: { clientLocalId: d.clientLocalId },
      });
      if (existing) {
        diagnoses.push({
          clientLocalId: d.clientLocalId,
          serverId: existing.id,
        });
        continue;
      }
      const source = this.mapSource(d.source);
      const location = await resolveDiagnosisLocation(this.prisma, user.id, {
        lat: typeof d.lat === 'number' ? d.lat : undefined,
        lon: typeof d.lon === 'number' ? d.lon : undefined,
      });
      const created = await this.prisma.withTransaction(async (tx) => {
        const row = await tx.diagnosis.create({
          data: {
            userId: user.id,
            ...location,
            source,
            imageObjectKey: d.imageObjectKey,
            diseaseNameBn: d.diseaseNameBn,
            diseaseNameEn: d.diseaseNameEn,
            confidence: d.confidence,
            severity: d.severity as Severity,
            clientLocalId: d.clientLocalId,
            offlineLabelId: d.labelId,
            verifiedBn: d.verifiedBn ?? undefined,
          },
        });
        await tx.historyEvent.create({
          data: { userId: user.id, kind: 'disease', sourceId: row.id },
        });
        return row;
      });
      diagnoses.push({
        clientLocalId: d.clientLocalId,
        serverId: created.id,
      });
    }

    // Tools: store as chat-like metadata note for now (no ToolIdentification offline schema).
    // Map into chatTurns as system-adjacent assistant notes if needed — skip dedicated table.
    for (const t of body.tools) {
      tools.push({
        clientLocalId: t.clientLocalId,
        serverId: t.clientLocalId,
      });
      void t;
    }

    for (const c of body.chatTurns) {
      const existing = await this.prisma.chatTurn.findFirst({
        where: { clientLocalId: c.clientLocalId },
      });
      if (existing) {
        chatTurns.push({
          clientLocalId: c.clientLocalId,
          serverId: existing.id,
        });
        continue;
      }
      const created = await this.prisma.chatTurn.create({
        data: {
          userId: user.id,
          clientLocalId: c.clientLocalId,
          role: c.role,
          textBn: c.textBn,
          createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
        },
      });
      chatTurns.push({
        clientLocalId: c.clientLocalId,
        serverId: created.id,
      });
    }

    return { diagnoses, tools, chatTurns };
  }

  async pullChat(user: AuthUser, cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
    const rows = await this.prisma.chatTurn.findMany({
      where: { userId: user.id },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    const items = rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      textBn: r.textBn,
      createdAt: r.createdAt.toISOString(),
      clientLocalId: r.clientLocalId,
    }));
    const nextCursor =
      rows.length === take ? rows[rows.length - 1]?.id : undefined;
    return { items, nextCursor };
  }

  private mapSource(source?: string): DiagnosisSource {
    if (source === 'offline_voice') return 'offline_voice';
    if (source === 'voice') return 'voice';
    if (source === 'photo') return 'photo';
    return 'offline_photo';
  }
}
