import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AI_RECEIPT } from '../ai/ai.tokens';
import type { AiReceiptPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(AI_RECEIPT) private readonly ai: AiReceiptPort,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('scan')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async scan(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const key = await this.storage.saveImage(file, 'receipts');
    const ai = await this.ai.scan(file!.buffer);
    const row = await this.prisma.receipt.create({
      data: {
        userId: user.id,
        imageObjectKey: key,
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
