import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TreatmentService } from '../treatment/treatment.service';
import { AI_TTS } from '../ai/ai.tokens';
import type { TtsPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Public } from '../common/decorators/public.decorator';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';
import { Throttle } from '@nestjs/throttler';
import { buildReportPdf } from './report-pdf';

const reportSchema = z.object({ diagnosisId: z.string().min(1) }).strict();
const ttsSchema = z
  .object({
    textBn: z.string().min(1).optional(),
    source: z.enum(['diagnosis', 'treatment', 'report']).optional(),
    id: z.string().optional(),
  })
  .strict();

const ttsStore = new Map<string, Buffer>();

@Controller()
export class ReportsTtsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly treatment: TreatmentService,
    @Inject(AI_TTS) private readonly tts: TtsPort,
  ) {}

  @Post('reports')
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(reportSchema)) body: z.infer<typeof reportSchema>,
  ) {
    const diagnosis = await this.prisma.diagnosis.findUnique({
      where: { id: body.diagnosisId },
      include: { crop: true },
    });
    if (!diagnosis) throw Errors.notFound();
    if (diagnosis.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    const plan = await this.treatment.getOrCreate(user, diagnosis.id);
    const report = await this.prisma.report.create({
      data: {
        userId: user.id,
        diagnosisId: diagnosis.id,
        treatmentPlanId: (plan as { id?: string }).id,
      },
    });
    return {
      id: report.id,
      diagnosis: {
        id: diagnosis.id,
        diseaseNameBn: diagnosis.diseaseNameBn,
        diseaseNameEn: diagnosis.diseaseNameEn,
        confidence: diagnosis.confidence,
        severity: diagnosis.severity,
        imageUrl: diagnosis.imageObjectKey
          ? this.storage.urlFor(diagnosis.imageObjectKey)
          : '',
      },
      treatment: plan,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @Get('reports/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { diagnosis: { include: { crop: true } } },
    });
    if (!report) throw Errors.notFound();
    if (report.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    const treatment = report.treatmentPlanId
      ? await this.treatment.getOrCreate(user, report.diagnosisId)
      : null;
    return {
      id: report.id,
      diagnosis: {
        id: report.diagnosis.id,
        diseaseNameBn: report.diagnosis.diseaseNameBn,
        diseaseNameEn: report.diagnosis.diseaseNameEn,
        confidence: report.diagnosis.confidence,
        severity: report.diagnosis.severity,
        imageUrl: report.diagnosis.imageObjectKey
          ? this.storage.urlFor(report.diagnosis.imageObjectKey)
          : '',
        cropNameBn: report.diagnosis.crop?.nameBn,
      },
      treatment,
      pdfUrl: report.pdfObjectKey
        ? this.storage.urlFor(report.pdfObjectKey)
        : null,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @Post('reports/:id/pdf')
  async pdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        user: true,
        diagnosis: { include: { crop: true } },
      },
    });
    if (!report) throw Errors.notFound();
    if (report.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();

    const plan = await this.treatment.getOrCreate(user, report.diagnosisId);
    const bytes = await buildReportPdf({
      farmerName: report.user.displayName,
      cropNameBn: plan.cropNameBn,
      diseaseNameBn: report.diagnosis.diseaseNameBn,
      diseaseNameEn: report.diagnosis.diseaseNameEn,
      confidence: report.diagnosis.confidence,
      severity: report.diagnosis.severity,
      pesticideNameBn: plan.pesticideNameBn,
      dosagePerBigha: plan.dosagePerBigha,
      followUpLabelBn: plan.followUpLabelBn,
      weatherReasonBn: plan.weatherAdvisory.reasonBn,
      steps: plan.steps,
    });
    const filename = `aronno-report-${id.slice(-8)}.pdf`;
    return {
      filename,
      pdfBase64: bytes.toString('base64'),
      downloadUrl: null as string | null,
    };
  }

  @Throttle({ default: { ttl: 60000, limit: 40 } })
  @Post('tts')
  async speak(@Body(new ZodPipe(ttsSchema)) body: z.infer<typeof ttsSchema>) {
    const text = body.textBn ?? 'আরণ্য থেকে শোনার সুবিধা।';
    const audio = await this.tts.synthesize(text);
    const id = `${Date.now()}`;
    ttsStore.set(id, audio);
    return {
      id,
      audioUrl: `/api/tts/audio/${id}`,
      audioBase64: audio.toString('base64'),
    };
  }

  @Public()
  @Get('tts/audio/:id')
  audio(@Param('id') id: string, @Res() res: Response) {
    const buf = ttsStore.get(id);
    if (!buf) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.send(buf);
  }
}
