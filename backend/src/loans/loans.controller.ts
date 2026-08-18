import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RepaymentPeriod } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

const PERIOD: Record<'3m' | '6m' | '12m', RepaymentPeriod> = {
  '3m': 'THREE_MONTHS',
  '6m': 'SIX_MONTHS',
  '12m': 'TWELVE_MONTHS',
};
const PERIOD_API: Record<RepaymentPeriod, '3m' | '6m' | '12m'> = {
  THREE_MONTHS: '3m',
  SIX_MONTHS: '6m',
  TWELVE_MONTHS: '12m',
};

const applySchema = z
  .object({
    amountBdt: z.number().int().positive(),
    purposeSlug: z.enum(['seed', 'fertilizer', 'equipment', 'other']),
    repaymentPeriod: z.enum(['3m', '6m', '12m']),
  })
  .strict();

function dateBn(d: Date) {
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

@Controller('loans')
export class LoansController {
  constructor(private readonly prisma: PrismaService) {}

  private dto(row: {
    id: string;
    amountBdt: number;
    status: string;
    repaymentPeriod: RepaymentPeriod;
    createdAt: Date;
    nextPaymentDue: Date | null;
    purpose: { slug: string; nameBn: string };
  }) {
    return {
      id: row.id,
      amountBdt: row.amountBdt,
      amountBn: `৳ ${row.amountBdt.toLocaleString('bn-BD')}`,
      purpose: row.purpose.slug,
      repaymentPeriod: PERIOD_API[row.repaymentPeriod],
      status: row.status,
      submittedDateBn: dateBn(row.createdAt),
      nextPaymentDateBn: row.nextPaymentDue ? dateBn(row.nextPaymentDue) : undefined,
    };
  }

  @Post()
  async apply(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(applySchema)) body: z.infer<typeof applySchema>,
  ) {
    const purpose = await this.prisma.loanPurpose.findUnique({
      where: { slug: body.purposeSlug },
    });
    if (!purpose) throw Errors.notFound();
    const row = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.loanApplication.create({
        data: {
          userId: user.id,
          amountBdt: body.amountBdt,
          purposeId: purpose.id,
          repaymentPeriod: PERIOD[body.repaymentPeriod],
          status: 'pending',
        },
        include: { purpose: true },
      });
      await tx.historyEvent.create({
        data: { userId: user.id, kind: 'loan', sourceId: created.id },
      });
      return created;
    });
    return this.dto(row);
  }

  @Get('current')
  async current(@CurrentUser() user: AuthUser) {
    const row = await this.prisma.loanApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { purpose: true },
    });
    return row ? this.dto(row) : null;
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { purpose: true },
    });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
    return this.dto(row);
  }
}
