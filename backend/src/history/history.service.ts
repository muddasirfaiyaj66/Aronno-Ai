import { Injectable } from '@nestjs/common';
import {
  HistoryKind,
  RepaymentPeriod,
  type HistoryEvent,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

const PERIOD_BN: Record<RepaymentPeriod, string> = {
  THREE_MONTHS: '৩ মাস',
  SIX_MONTHS: '৬ মাস',
  TWELVE_MONTHS: '১২ মাস',
};

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
      where: { userId: ownerId, ...(kind ? { kind } : {}) },
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
    if (event.kind === 'disease') {
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
    if (event.kind === 'yield') {
      const y = await this.prisma.yieldEstimate.findUnique({
        where: { id: event.sourceId },
        include: { crop: true },
      });
      if (!y) return null;
      return {
        ...base,
        kind: 'yield' as const,
        sourceId: y.id,
        cropNameBn: y.crop.nameBn,
        yieldValue: y.estimatedMaxMon,
        yieldUnitBn: 'মণ',
        trend: y.trend,
      };
    }
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: event.sourceId },
      include: { purpose: true },
    });
    if (!loan) return null;
    return {
      ...base,
      kind: 'loan' as const,
      sourceId: loan.id,
      title: `কৃষি ঋণ — ${loan.purpose.nameBn}`,
      amount: `৳ ${loan.amountBdt.toLocaleString('bn-BD')}`,
      status: loan.status,
      nextPaymentDate: loan.nextPaymentDue
        ? dateBn(loan.nextPaymentDue)
        : undefined,
      repaymentPeriodBn: PERIOD_BN[loan.repaymentPeriod],
    };
  }
}
