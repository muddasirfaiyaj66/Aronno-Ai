import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_YIELD, WEATHER } from '../ai/ai.tokens';
import type { AiYieldPort, WeatherPort } from '../ai/ports';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

@Controller('yield')
export class YieldController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_YIELD) private readonly ai: AiYieldPort,
    @Inject(WEATHER) private readonly weather: WeatherPort,
  ) {}

  @Get('latest')
  async latest(@CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { district: true },
    });
    const row = await this.prisma.yieldEstimate.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { crop: true },
    });
    return row ? this.dto(row, me?.district?.nameBn) : null;
  }

  @Post('predict')
  async predict(@CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { district: true },
    });
    const rice = await this.prisma.crop.findUnique({ where: { slug: 'rice' } });
    if (!rice) throw Errors.notFound();
    const predicted = await this.ai.predict('rice');
    const weatherSummaryBn = await this.weather.summaryBn();
    const row = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.yieldEstimate.create({
        data: {
          userId: user.id,
          cropId: rice.id,
          ...predicted,
          weatherSummaryBn,
        },
        include: { crop: true },
      });
      await tx.historyEvent.create({
        data: { userId: user.id, kind: 'yield', sourceId: created.id },
      });
      return created;
    });
    return this.dto(row, me?.district?.nameBn);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.yieldEstimate.findUnique({
      where: { id },
      include: { crop: true },
    });
    if (!row) throw Errors.notFound();
    if (row.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
    return this.dto(row);
  }

  private dto(
    row: {
      id: string;
      landSizeBn: string;
      weatherSummaryBn: string;
      estimatedMinMon: number;
      estimatedMaxMon: number;
      lastSeasonMon: number;
      trend: string;
      changePercent: number;
      crop: { nameBn: string };
    },
    districtBn?: string,
  ) {
    return {
      id: row.id,
      cropNameBn: row.crop.nameBn,
      districtBn,
      landSizeBn: row.landSizeBn,
      weatherSummaryBn: row.weatherSummaryBn,
      estimatedMinMon: row.estimatedMinMon,
      estimatedMaxMon: row.estimatedMaxMon,
      lastSeasonMon: row.lastSeasonMon,
      trend: row.trend,
      changePercent: row.changePercent,
    };
  }
}
