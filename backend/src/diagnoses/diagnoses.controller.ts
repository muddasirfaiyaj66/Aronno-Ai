import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { DiagnosesService } from './diagnoses.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { imageUrlSchema } from '../common/schemas';
import type { AuthUser } from '../auth/auth.types';

const voiceSchema = z
  .object({
    transcriptBn: z.string().min(3),
    cropSlug: z.string().optional(),
  })
  .strict();

@Controller('diagnoses')
export class DiagnosesController {
  constructor(private readonly diagnoses: DiagnosesService) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('photo')
  createPhoto(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(imageUrlSchema)) body: z.infer<typeof imageUrlSchema>,
  ) {
    return this.diagnoses.createPhoto(user, body.imageUrl);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('voice')
  createVoice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(voiceSchema)) body: z.infer<typeof voiceSchema>,
  ) {
    return this.diagnoses.createVoice(user, body.transcriptBn, body.cropSlug);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.diagnoses.list(user, cursor, Number(limit) || 20);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagnoses.get(user, id);
  }
}
