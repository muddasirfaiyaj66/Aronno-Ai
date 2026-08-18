import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
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
    const ai = await this.ai.scan(Buffer.from(body.imageUrl));
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
            sortOrder: i,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
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
    if (row.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
    return this.dto(row);
  }

  private dto(row: {
    id: string;
    totalBdt: number;
    summaryBn: string;
    items: { id: string; nameBn: string; quantity: string; priceBn: string }[];
  }) {
    return {
      id: row.id,
      totalBdt: row.totalBdt,
      summaryBn: row.summaryBn,
      items: row.items.map((i) => ({
        id: i.id,
        nameBn: i.nameBn,
        quantity: i.quantity,
        price: i.priceBn,
      })),
    };
  }
}
