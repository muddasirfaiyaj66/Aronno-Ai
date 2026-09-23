import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { COST_ESTIMATE } from '../ai/ai.tokens';
import type { CostEstimatePort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';
import { COST_CROP_SLUGS, type CultivationCost } from './cultivation-costs';

const createSchema = z
  .object({
    cropSlug: z.enum(COST_CROP_SLUGS),
    landSize: z.number().positive(),
    landUnit: z.enum(['bigha', 'acre']),
  })
  .strict();

@Controller('cost-estimates')
export class CostController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COST_ESTIMATE) private readonly port: CostEstimatePort,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>,
  ) {
    const crop = await this.prisma.crop.findUnique({
      where: { slug: body.cropSlug },
    });
    if (!crop) throw Errors.notFound();
    const { cultivation, ...spray } = this.port.estimate(
      body.cropSlug,
      body.landSize,
      body.landUnit,
    );
    const row = await this.prisma.costEstimate.create({
      data: {
        userId: user.id,
        cropId: crop.id,
        landSize: body.landSize,
        landUnit: body.landUnit,
        ...spray,
        cultivationTotalBdt: cultivation.totalBdt,
        breakdown: cultivation,
      },
    });
    return this.dto(row);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.costEstimate.findUnique({ where: { id } });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER')
      throw Errors.forbidden();
    return this.dto(row);
  }

  private dto(row: {
    id: string;
    pesticideQuantity: string;
    totalCostBdt: number;
    spraySessions: number;
    breakdown: unknown;
  }) {
    return {
      id: row.id,
      pesticideQuantity: row.pesticideQuantity,
      totalCostBdt: row.totalCostBdt,
      spraySessions: row.spraySessions,
      cultivation: (row.breakdown as CultivationCost | null) ?? undefined,
    };
  }
}
