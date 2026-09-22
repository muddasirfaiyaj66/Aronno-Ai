import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { SyncService } from './sync.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { Errors } from '../common/errors';
import { messageFromZodError } from '../common/zod-messages';

const offlineBodySchema = z
  .object({
    diagnoses: z
      .array(
        z.object({
          clientLocalId: z.string().min(1),
          labelId: z.string().optional(),
          diseaseNameBn: z.string().min(1),
          diseaseNameEn: z.string().min(1),
          confidence: z.number().int().min(0).max(100),
          severity: z.enum(['low', 'medium', 'high']),
          verifiedBn: z.string().nullable().optional(),
          source: z
            .enum(['offline_photo', 'offline_voice', 'photo', 'voice'])
            .optional(),
          imageObjectKey: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
    tools: z
      .array(
        z.object({
          clientLocalId: z.string().min(1),
          labelId: z.string().optional(),
          toolNameBn: z.string().min(1),
          toolNameEn: z.string().min(1),
          reasonBn: z.string().optional(),
          verifiedBn: z.string().nullable().optional(),
          imageObjectKey: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
    chatTurns: z
      .array(
        z.object({
          clientLocalId: z.string().min(1),
          role: z.enum(['user', 'assistant']),
          textBn: z.string().min(1),
          createdAt: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
  })
  .strict();

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('offline')
  upload(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = offlineBodySchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.validation(
        parsed.error.flatten(),
        messageFromZodError(parsed.error),
      );
    }
    return this.sync.uploadOffline(user, parsed.data);
  }

  @Get('chat')
  pullChat(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sync.pullChat(user, cursor, Number(limit) || 50);
  }
}
