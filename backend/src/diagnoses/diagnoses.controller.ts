import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { DiagnosesService } from './diagnoses.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { httpUrl } from '../common/schemas';
import type { AuthUser } from '../auth/auth.types';

const geo = {
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
};

const photoSchema = z.object({ imageUrl: httpUrl, ...geo }).strict();

const voiceSchema = z
  .object({
    transcriptBn: z.string().min(3),
    cropSlug: z.string().optional(),
    ...geo,
  })
  .strict();

const transcribeSchema = z
  .object({
    audioBase64: z.string().min(80),
    mimeType: z.string().min(3).max(80).optional(),
  })
  .strict();

@Controller('diagnoses')
export class DiagnosesController {
  constructor(private readonly diagnoses: DiagnosesService) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('photo')
  createPhoto(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(photoSchema)) body: z.infer<typeof photoSchema>,
  ) {
    return this.diagnoses.createPhoto(user, body.imageUrl, body);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('voice')
  createVoice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(voiceSchema)) body: z.infer<typeof voiceSchema>,
  ) {
    return this.diagnoses.createVoice(
      user,
      body.transcriptBn,
      body.cropSlug,
      body,
    );
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('transcribe')
  transcribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(transcribeSchema)) body: z.infer<typeof transcribeSchema>,
  ) {
    void user;
    return this.diagnoses.transcribe(body.audioBase64, body.mimeType);
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
