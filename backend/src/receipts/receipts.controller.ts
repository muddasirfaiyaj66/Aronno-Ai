import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AI_RECEIPT } from '../ai/ai.tokens';
import type { AiReceiptPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Errors } from '../common/errors';
import { imageUrlSchema } from '../common/schemas';
import type { AuthUser } from '../auth/auth.types';
import { formatTakaBn, parseTaka } from '../common/bn-digits';

const reviewSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            nameBn: z.string().trim().min(1).max(120),
            quantity: z.string().trim().max(60).default(''),
            priceBdt: z.number().nonnegative().max(10_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    /** Omit to use the sum of the items. */
    totalBdt: z.number().nonnegative().max(100_000_000).optional(),
  })
  .strict();

type ItemRow = {
  id: string;
  nameBn: string;
  quantity: string;
  priceBn: string;
  priceBdt: number | null;
};

function itemTaka(item: { priceBn: string; priceBdt: number | null }) {
  return item.priceBdt ?? parseTaka(item.priceBn);
}

/** Printed total and item sum disagree by more than ৳10 and 5%. */
function totalsDisagree(totalBdt: number, items: ItemRow[]) {
  const sum = items.reduce((acc, i) => acc + itemTaka(i), 0);
  const diff = Math.abs(sum - totalBdt);
  return diff > 10 && diff > totalBdt * 0.05;
}

function summaryFor(
  totalBdt: number,
  items: { nameBn: string; priceBdt: number }[],
) {
  const top = [...items].sort((a, b) => b.priceBdt - a.priceBdt)[0];
  const head = `মোট ${formatTakaBn(totalBdt)} টাকা খরচ হয়েছে।`;
  return top && top.priceBdt > 0
    ? `${head} সবচেয়ে বেশি খরচ ${top.nameBn}-এ, ${formatTakaBn(top.priceBdt)} টাকা।`
    : head;
}

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_RECEIPT) private readonly ai: AiReceiptPort,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('scan')
  async scan(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(imageUrlSchema)) body: z.infer<typeof imageUrlSchema>,
  ) {
    const ai = await this.ai.scan({ imageUrl: body.imageUrl });
    const row = await this.prisma.receipt.create({
      data: {
        userId: user.id,
        imageObjectKey: body.imageUrl,
        totalBdt: ai.totalBdt,
        summaryBn: ai.summaryBn,
        items: {
          create: ai.items.map((item, i) => ({
            nameBn: item.nameBn,
            quantity: item.quantity,
            priceBn: item.priceBn,
            priceBdt: Math.round(item.priceBdt),
            sortOrder: i,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.dto(row);
  }

  /** Farmer-checked items replace the AI read; total defaults to their sum. */
  @Patch(':id')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(reviewSchema)) body: z.infer<typeof reviewSchema>,
  ) {
    const existing = await this.prisma.receipt.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound();
    if (existing.userId !== user.id) throw Errors.forbidden();

    const items = body.items.map((item) => ({
      ...item,
      priceBdt: Math.round(item.priceBdt),
    }));
    const totalBdt = Math.round(
      body.totalBdt ?? items.reduce((acc, i) => acc + i.priceBdt, 0),
    );
    const row = await this.prisma.withTransaction(async (tx) => {
      await tx.receiptItem.deleteMany({ where: { receiptId: id } });
      return tx.receipt.update({
        where: { id },
        data: {
          totalBdt,
          summaryBn: summaryFor(totalBdt, items),
          reviewedAt: new Date(),
          items: {
            create: items.map((item, i) => ({
              nameBn: item.nameBn,
              quantity: item.quantity || '—',
              priceBn: `৳ ${formatTakaBn(item.priceBdt)}`,
              priceBdt: item.priceBdt,
              sortOrder: i,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
    return this.dto(row);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.receipt.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    return this.dto(row);
  }

  private dto(row: {
    id: string;
    totalBdt: number;
    summaryBn: string;
    reviewedAt: Date | null;
    items: ItemRow[];
  }) {
    return {
      id: row.id,
      totalBdt: row.totalBdt,
      summaryBn: row.summaryBn,
      reviewed: !!row.reviewedAt,
      totalsMismatch: totalsDisagree(row.totalBdt, row.items),
      items: row.items.map((i) => ({
        id: i.id,
        nameBn: i.nameBn,
        quantity: i.quantity,
        price: i.priceBn,
        priceBdt: itemTaka(i),
      })),
    };
  }
}
