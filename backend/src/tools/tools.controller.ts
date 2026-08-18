import {
  Body,
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
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AI_TOOLS } from '../ai/ai.tokens';
import type { AiToolsPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

const voiceSchema = z.object({ transcriptBn: z.string().min(3) }).strict();

@Controller('tools')
export class ToolsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(AI_TOOLS) private readonly ai: AiToolsPort,
  ) {}

  private dto(row: {
    id: string;
    toolNameBn: string;
    toolNameEn: string;
    reasonBn: string;
    listings: {
      id: string;
      sourceName: string;
      thumbnailUrl: string;
      priceBn: string | null;
      externalUrl: string;
    }[];
  }) {
    return {
      id: row.id,
      toolNameBn: row.toolNameBn,
      toolNameEn: row.toolNameEn,
      reasonBn: row.reasonBn,
      listings: row.listings.map((l) => ({
        id: l.id,
        sourceName: l.sourceName,
        thumbnailUrl: l.thumbnailUrl,
        price: l.priceBn ?? undefined,
        externalUrl: l.externalUrl,
      })),
    };
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('identify/photo')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async photo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const key = await this.storage.saveImage(file, 'tools');
    const ai = await this.ai.identify({ imageBuffer: file!.buffer });
    return this.persist(user.id, 'photo', ai, key);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('identify/voice')
  async voice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(voiceSchema)) body: z.infer<typeof voiceSchema>,
  ) {
    const ai = await this.ai.identify({ transcriptBn: body.transcriptBn });
    return this.persist(user.id, 'voice', ai, undefined, body.transcriptBn);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.toolIdentification.findUnique({
      where: { id },
      include: { listings: true },
    });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
    return this.dto(row);
  }

  private async persist(
    userId: string,
    source: 'photo' | 'voice',
    ai: Awaited<ReturnType<AiToolsPort['identify']>>,
    imageObjectKey?: string,
    transcriptBn?: string,
  ) {
    const row = await this.prisma.toolIdentification.create({
      data: {
        userId,
        source,
        imageObjectKey,
        transcriptBn,
        toolNameBn: ai.toolNameBn,
        toolNameEn: ai.toolNameEn,
        reasonBn: ai.reasonBn,
        listings: {
          create: ai.listings.map((l) => ({
            sourceName: l.sourceName,
            thumbnailUrl: l.thumbnailUrl,
            priceBn: l.priceBn,
            externalUrl: l.externalUrl,
          })),
        },
      },
      include: { listings: true },
    });
    return this.dto(row);
  }
}
