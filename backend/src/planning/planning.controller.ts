import { Controller, Get, Inject, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PLANNING } from '../ai/ai.tokens';
import type { AiPlanningPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('crop-plans')
export class PlanningController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PLANNING) private readonly ai: AiPlanningPort,
  ) {}

  @Post('generate')
  async generate(@CurrentUser() user: AuthUser) {
    const plan = await this.ai.generate();
    const row = await this.prisma.cropPlan.create({
      data: {
        userId: user.id,
        recommendationBn: plan.recommendationBn,
        months: {
          create: plan.months.map((m, i) => ({
            monthBn: m.monthBn,
            weatherIcon: m.weatherIcon,
            recommendedCropBn: m.recommendedCropBn,
            sortOrder: i,
          })),
        },
      },
      include: { months: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.dto(row);
  }

  @Get('latest')
  async latest(@CurrentUser() user: AuthUser) {
    const row = await this.prisma.cropPlan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { months: { orderBy: { sortOrder: 'asc' } } },
    });
    return row ? this.dto(row) : null;
  }

  private dto(row: {
    id: string;
    recommendationBn: string;
    months: {
      monthBn: string;
      weatherIcon: string;
      recommendedCropBn: string;
    }[];
  }) {
    return {
      id: row.id,
      recommendationBn: row.recommendationBn,
      months: row.months.map((m) => ({
        month: m.monthBn,
        weatherIcon: m.weatherIcon,
        recommendedCropBn: m.recommendedCropBn,
      })),
    };
  }
}
