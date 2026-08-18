import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { DiagnosesService } from './diagnoses.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
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
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  createPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.diagnoses.createPhoto(user, file);
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
