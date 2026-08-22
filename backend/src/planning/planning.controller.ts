import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WEATHER } from '../ai/ai.tokens';
import type { WeatherPort } from '../weather/weather.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { WeatherLocationService } from '../weather/weather-location.service';

@Controller('crop-plans')
export class PlanningController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEATHER) private readonly weather: WeatherPort,
    private readonly locations: WeatherLocationService,
  ) {}

  @Post('generate')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() body?: { lat?: number; lon?: number },
  ) {
    const point = await this.locations.forUser(user.id, body?.lat, body?.lon);
    const plan = await this.weather.sixMonthPlan(point);
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
    return this.dto(row, plan.months);
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

  private dto(
    row: {
      id: string;
      recommendationBn: string;
      months: {
        monthBn: string;
        weatherIcon: string;
        recommendedCropBn: string;
      }[];
    },
    live?: { tempC?: number; precipMm?: number }[],
  ) {
    return {
      id: row.id,
      recommendationBn: row.recommendationBn,
      months: row.months.map((m, i) => ({
        month: m.monthBn,
        weatherIcon: m.weatherIcon,
        recommendedCropBn: m.recommendedCropBn,
        tempC: live?.[i]?.tempC,
        precipMm: live?.[i]?.precipMm,
      })),
    };
  }
}
