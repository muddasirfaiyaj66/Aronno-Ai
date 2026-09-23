import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import type { FertilizerAdvice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_FERTILIZER } from '../ai/ai.tokens';
import type { AiFertilizerPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

const schema = z
  .object({
    cropSlug: z.string().min(1),
    growthStage: z.enum(['seedling', 'vegetative', 'flowering', 'maturity']),
    soilColor: z.enum(['dark', 'medium', 'light']),
    soilMoisture: z.enum(['wet', 'moist', 'dry']),
    landSizeBigha: z.number().positive().max(500),
    cropAgeDays: z.number().int().min(0).max(400),
    hasDisease: z.enum(['yes', 'no', 'unsure']),
    /** Linked from the farmer's latest diagnosis instead of re-asking. */
    diagnosisId: z.string().min(1).optional(),
    /** Same, for a scan that has not synced to the server yet. */
    diseaseNameBn: z.string().trim().min(2).max(80).optional(),
    diseaseSeverity: z.enum(['low', 'medium', 'high']).optional(),
  })
  .strict();

@Controller('fertilizer')
export class FertilizerController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_FERTILIZER) private readonly ai: AiFertilizerPort,
  ) {}

  @Post('recommend')
  async recommend(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(schema)) body: z.infer<typeof schema>,
  ) {
    const crop = await this.prisma.crop.findUnique({
      where: { slug: body.cropSlug },
    });
    if (!crop) throw Errors.notFound();
    const { diagnosisId, diseaseNameBn, diseaseSeverity, ...inputs } = body;
    const diagnosis =
      diagnosisId && body.hasDisease === 'yes'
        ? await this.prisma.diagnosis.findFirst({
            where: { id: diagnosisId, userId: user.id },
          })
        : null;
    const linked =
      body.hasDisease === 'yes'
        ? {
            diseaseNameBn: diagnosis?.diseaseNameBn ?? diseaseNameBn,
            diseaseSeverity: diagnosis?.severity ?? diseaseSeverity,
          }
        : {};
    const ai = await this.ai.recommend({ ...inputs, ...linked });
    const row = await this.prisma.fertilizerAdvice.create({
      data: {
        userId: user.id,
        cropId: crop.id,
        growthStage: body.growthStage,
        soilColor: body.soilColor,
        soilMoisture: body.soilMoisture,
        landSizeBigha: body.landSizeBigha,
        cropAgeDays: body.cropAgeDays,
        hasDisease: body.hasDisease,
        diseaseNameBn: linked.diseaseNameBn,
        ...ai,
      },
    });
    return this.dto(row);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.fertilizerAdvice.findUnique({
      where: { id },
    });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    return this.dto(row);
  }

  private dto(row: FertilizerAdvice) {
    return {
      id: row.id,
      fertilizerNameBn: row.fertilizerNameBn,
      dosagePerBigha: row.dosagePerBigha,
      applicationMethodBn: row.applicationMethodBn,
      timingBn: row.timingBn,
      warningBn: row.warningBn ?? undefined,
      reasonBn: row.reasonBn ?? undefined,
      landSizeBigha: row.landSizeBigha ?? undefined,
      cropAgeDays: row.cropAgeDays ?? undefined,
      hasDisease: row.hasDisease ?? undefined,
      diseaseNameBn: row.diseaseNameBn ?? undefined,
    };
  }
}
