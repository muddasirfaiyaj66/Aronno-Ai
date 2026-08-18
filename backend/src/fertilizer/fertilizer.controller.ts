import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
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
    const crop = await this.prisma.crop.findUnique({ where: { slug: body.cropSlug } });
    if (!crop) throw Errors.notFound();
    const ai = await this.ai.recommend(body);
    const row = await this.prisma.fertilizerAdvice.create({
      data: {
        userId: user.id,
        cropId: crop.id,
        ...body,
        ...ai,
      },
    });
    return {
      id: row.id,
      fertilizerNameBn: row.fertilizerNameBn,
      dosagePerBigha: row.dosagePerBigha,
      applicationMethodBn: row.applicationMethodBn,
      timingBn: row.timingBn,
      warningBn: row.warningBn ?? undefined,
    };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.fertilizerAdvice.findUnique({ where: { id } });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
    return {
      id: row.id,
      fertilizerNameBn: row.fertilizerNameBn,
      dosagePerBigha: row.dosagePerBigha,
      applicationMethodBn: row.applicationMethodBn,
      timingBn: row.timingBn,
      warningBn: row.warningBn ?? undefined,
    };
  }
}
