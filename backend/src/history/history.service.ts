import { Injectable } from '@nestjs/common';
import type { HistoryEvent, HistoryKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

/**
 * Only disease events are surfaced. Older `yield` / `loan` rows may still sit
 * in the database from retired features; they are never returned.
 */
const VISIBLE_KINDS: HistoryKind[] = ['disease'];

function dateBn(d: Date) {
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(
    user: AuthUser,
    kind?: HistoryKind,
    userId?: string,
    cursor?: string,
    limit = 30,
  ) {
    const ownerId = user.role === 'USER' ? user.id : (userId ?? user.id);
    const events: HistoryEvent[] = await this.prisma.historyEvent.findMany({
      where: {
        userId: ownerId,
        kind:
          kind && VISIBLE_KINDS.includes(kind) ? kind : { in: VISIBLE_KINDS },
      },
      take: Math.min(limit, 50),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { occurredAt: 'desc' },
    });
    const rows = await Promise.all(events.map((e) => this.assemble(e)));
    return rows.filter(Boolean);
  }

  async get(user: AuthUser, id: string) {
    const event = await this.prisma.historyEvent.findUnique({ where: { id } });
    if (!event) throw Errors.notFound();
    if (event.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    if (!VISIBLE_KINDS.includes(event.kind)) throw Errors.notFound();
    const assembled = await this.assemble(event);
    if (!assembled) throw Errors.notFound();
    return assembled;
  }

  /** Remove from history feed (HistoryEvent). Accepts event id or disease sourceId. */
  async remove(user: AuthUser, id: string) {
    const ownerFilter =
      user.role === 'USER' ? { userId: user.id } : ({} as { userId?: string });

    const matches = await this.prisma.historyEvent.findMany({
      where: {
        ...ownerFilter,
        OR: [{ id }, { sourceId: id }],
      },
    });

    if (matches.length === 0) throw Errors.notFound();
    for (const event of matches) {
      if (event.userId !== user.id && user.role === 'USER')
        throw Errors.forbidden();
    }

    await this.prisma.historyEvent.deleteMany({
      where: { id: { in: matches.map((m) => m.id) } },
    });

    return { ok: true, deleted: matches.map((m) => m.id) };
  }

  private async assemble(event: {
    id: string;
    kind: HistoryKind;
    sourceId: string;
    occurredAt: Date;
  }) {
    const base = {
      id: event.id,
      date: event.occurredAt.toISOString().slice(0, 10),
      dateBn: dateBn(event.occurredAt),
    };
    if (event.kind !== 'disease') return null;
    const d = await this.prisma.diagnosis.findUnique({
      where: { id: event.sourceId },
      include: { crop: true },
    });
    if (!d) return null;
    return {
      ...base,
      kind: 'disease' as const,
      sourceId: d.id,
      cropNameBn: d.crop?.nameBn ?? 'ফসল',
      diseaseNameBn: d.diseaseNameBn,
      diseaseNameEn: d.diseaseNameEn,
      severity: d.severity,
      confidence: d.confidence,
      imageUrl: d.imageObjectKey ? this.storage.urlFor(d.imageObjectKey) : '',
    };
  }
}
