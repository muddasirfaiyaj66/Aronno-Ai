import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_YIELD, WEATHER } from '../ai/ai.tokens';
import type { AiYieldPort } from '../ai/ports';
import type { WeatherPort } from '../weather/weather.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';
import { WeatherLocationService } from '../weather/weather-location.service';

@Controller('yield')
export class YieldController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_YIELD) private readonly ai: AiYieldPort,
    @Inject(WEATHER) private readonly weather: WeatherPort,
    private readonly locations: WeatherLocationService,
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
  async predict(
    @CurrentUser() user: AuthUser,
    @Body() body?: { lat?: number; lon?: number },
  ) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { district: true },
    });
    const rice = await this.prisma.crop.findUnique({ where: { slug: 'rice' } });
    if (!rice) throw Errors.notFound();
    const predicted = await this.ai.predict('rice');
    const point = await this.locations.forUser(user.id, body?.lat, body?.lon);
    const weatherSummaryBn = await this.weather.summaryBn(point);
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
