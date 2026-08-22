import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { WEATHER } from '../ai/ai.tokens';
import type { WeatherPort } from '../weather/weather.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { WeatherLocationService } from '../weather/weather-location.service';
import { GeminiClient } from '../ai/gemini.client';

const recSchema = z.object({ recommendationBn: z.string().trim().min(12) });

@Controller('crop-plans')
export class PlanningController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEATHER) private readonly weather: WeatherPort,
    private readonly locations: WeatherLocationService,
    private readonly gemini: GeminiClient,
  ) {}

  @Post('generate')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() body?: { lat?: number; lon?: number },
  ) {
    const point = await this.locations.forUser(user.id, body?.lat, body?.lon);
    const plan = await this.weather.sixMonthPlan(point);
    const recommendationBn = await this.polishRecommendation(point.locationBn, plan);
    const row = await this.prisma.cropPlan.create({
      data: {
        userId: user.id,
        recommendationBn,
        months: {
          create: plan.months.map((m, i) => ({
            monthBn: m.monthBn,
            weatherIcon: m.weatherIcon,
            recommendedCropBn: m.recommendedCropBn,
            tempC: m.tempC,
            precipMm: m.precipMm,
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

  private async polishRecommendation(
    locationBn: string,
    plan: { recommendationBn: string; months: { monthBn: string; recommendedCropBn: string; tempC?: number; precipMm?: number }[] },
  ) {
    const monthLines = plan.months
      .map(
        (m) =>
          `${m.monthBn}: ${m.recommendedCropBn} (গড় ${m.tempC ?? '—'}°, বৃষ্টি ${m.precipMm ?? '—'} মিমি)`,
      )
      .join('\n');
    try {
      const raw = await this.gemini.generateJson<unknown>(
        `Write a practical 4-6 sentence Bangla crop plan for a smallholder in ${locationBn}, Bangladesh.
Use this 6-month outlook:
${monthLines}
Mention which months to plant, irrigate, or avoid spraying in rain. Short sentences. JSON only:
{"recommendationBn":"..."}`,
      );
      return recSchema.parse(raw).recommendationBn;
    } catch {
      return plan.recommendationBn;
    }
  }

  private dto(row: {
    id: string;
    recommendationBn: string;
    months: {
      monthBn: string;
      weatherIcon: string;
      recommendedCropBn: string;
      tempC: number | null;
      precipMm: number | null;
    }[];
  }) {
    return {
      id: row.id,
      recommendationBn: row.recommendationBn,
      months: row.months.map((m) => ({
        month: m.monthBn,
        weatherIcon: m.weatherIcon,
        recommendedCropBn: m.recommendedCropBn,
        tempC: m.tempC ?? undefined,
        precipMm: m.precipMm ?? undefined,
      })),
    };
  }
}
