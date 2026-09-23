import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WEATHER } from '../ai/ai.tokens';
import type {
  MonthOutlook,
  OutlookSource,
  WeatherPort,
} from '../weather/weather.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import type { AuthUser } from '../auth/auth.types';
import { WeatherLocationService } from '../weather/weather-location.service';
import { GeminiClient } from '../ai/gemini.client';
import {
  cultivationCost,
  toBigha,
  type CostCropSlug,
  type CultivationCost,
} from '../cost/cultivation-costs';
import {
  PLAN_CROPS,
  asPlanSlug,
  defaultWindows,
  durationsForPrompt,
  inMonthBn,
  slugForCropBn,
} from './crop-calendar';

const generateSchema = z
  .object({
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    /** Land for the attached cost estimate (defaults to 1 bigha). */
    landSize: z.number().positive().max(10_000).optional(),
    landUnit: z.enum(['bigha', 'acre']).optional(),
  })
  .strict();

const text = z.string().trim().min(2).max(160);

const aiPlanSchema = z.object({
  recommendationBn: z.string().trim().min(40),
  months: z
    .array(
      z.object({
        cropSlug: z.string(),
        cropBn: z.string().trim().min(2).max(30).optional(),
        plantingWindowBn: text,
        harvestWindowBn: text,
        reasonBn: text,
      }),
    )
    .min(1),
});

type PlannedMonth = MonthOutlook & {
  cropSlug: CostCropSlug;
  plantingWindowBn: string;
  harvestWindowBn: string;
  reasonBn: string;
};

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
    @Body(new ZodPipe(generateSchema)) body: z.infer<typeof generateSchema>,
  ) {
    const point = await this.locations.forUser(user.id, body.lat, body.lon);
    const outlook = await this.weather.sixMonthPlan(point);
    const { months, recommendationBn } = await this.planMonths(
      point.locationBn,
      outlook,
    );

    const landSizeBigha = toBigha(body.landSize ?? 1, body.landUnit ?? 'bigha');
    const costEstimate = cultivationCost(months[0].cropSlug, landSizeBigha);

    const row = await this.prisma.cropPlan.create({
      data: {
        userId: user.id,
        recommendationBn,
        costEstimate,
        months: {
          create: months.map((m, i) => ({
            monthBn: m.monthBn,
            weatherIcon: m.weatherIcon,
            recommendedCropBn: m.recommendedCropBn,
            tempC: m.tempC,
            precipMm: m.precipMm,
            cropSlug: m.cropSlug,
            plantingWindowBn: m.plantingWindowBn,
            harvestWindowBn: m.harvestWindowBn,
            reasonBn: m.reasonBn,
            sortOrder: i,
          })),
        },
      },
      include: { months: { orderBy: { sortOrder: 'asc' } } },
    });
    return { ...this.dto(row), outlookSource: outlook.source };
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

  /**
   * Gemini picks one priority crop per forecast month with planting and
   * harvest windows grounded in that month's rain/temperature. Falls back to
   * the rule-based crop + crop-calendar windows if the AI call fails.
   */
  private async planMonths(
    locationBn: string,
    outlook: {
      recommendationBn: string;
      months: MonthOutlook[];
      source: OutlookSource;
    },
  ): Promise<{ months: PlannedMonth[]; recommendationBn: string }> {
    const fallback = outlook.months.map((m) => {
      const cropSlug = slugForCropBn(m.recommendedCropBn);
      return {
        ...m,
        cropSlug,
        ...defaultWindows(cropSlug, m.monthIso),
        reasonBn: reasonFromWeather(m),
      };
    });

    const monthLines = outlook.months
      .map(
        (m, i) =>
          `${i + 1}. ${m.monthBn} (${m.monthIso}): mean temp ${m.tempC ?? '?'}°C, rain ${m.precipMm ?? '?'} mm; rule-based suggestion: ${m.recommendedCropBn}`,
      )
      .join('\n');
    const sourceNote =
      outlook.source === 'seasonal'
        ? 'Open-Meteo seasonal forecast (monthly means)'
        : 'Bangladesh long-term monthly climate normals (forecast unavailable)';

    try {
      const raw = await this.gemini.generateJson<unknown>(
        `You are an agronomist planning the next ${outlook.months.length} months for a smallholder farmer in ${locationBn}, Bangladesh.
Weather outlook (${sourceNote}):
${monthLines}

For EACH month, in the same order, choose ONE priority crop from this list only (cropSlug=Bangla name, growing duration):
${durationsForPrompt()}
Give:
- cropSlug: one slug from the list
- cropBn: short Bangla crop label, may add the season (e.g. "আমন ধান", "বোরো ধান", "শীতের সবজি")
- plantingWindowBn: when to sow/transplant, e.g. "অক্টোবরের ২য়–৩য় সপ্তাহ". If this month is for tending or harvesting a crop planted earlier, say so, e.g. "আগে রোপণ করা — যত্নের সময়".
- harvestWindowBn: expected harvest months from that crop's duration, e.g. "জানুয়ারি–ফেব্রুয়ারি"
- reasonBn: one short Bangla sentence that cites this month's rain or temperature figure.
Then recommendationBn: 4–6 short Bangla sentences naming specific months, crops, planting and harvest windows, and rain-related cautions (drainage, irrigation, when not to spray). No generic advice.

JSON only:
{"months":[{"cropSlug":"rice","cropBn":"আমন ধান","plantingWindowBn":"...","harvestWindowBn":"...","reasonBn":"..."}],"recommendationBn":"..."}`,
      );
      const parsed = aiPlanSchema.parse(raw);
      const months = fallback.map((base, i) => {
        const ai = parsed.months[i];
        const slug = ai ? asPlanSlug(ai.cropSlug) : null;
        if (!ai || !slug) return base;
        return {
          ...base,
          cropSlug: slug,
          recommendedCropBn: ai.cropBn ?? PLAN_CROPS[slug].nameBn,
          plantingWindowBn: ai.plantingWindowBn,
          harvestWindowBn: ai.harvestWindowBn,
          reasonBn: ai.reasonBn,
        };
      });
      return { months, recommendationBn: parsed.recommendationBn };
    } catch {
      return {
        months: fallback,
        recommendationBn: fallbackRecommendation(locationBn, fallback),
      };
    }
  }

  private dto(row: {
    id: string;
    recommendationBn: string;
    costEstimate: Prisma.JsonValue | null;
    months: {
      monthBn: string;
      weatherIcon: string;
      recommendedCropBn: string;
      tempC: number | null;
      precipMm: number | null;
      cropSlug: string | null;
      plantingWindowBn: string | null;
      harvestWindowBn: string | null;
      reasonBn: string | null;
    }[];
  }) {
    return {
      id: row.id,
      recommendationBn: row.recommendationBn,
      costEstimate:
        (row.costEstimate as unknown as CultivationCost | null) ?? undefined,
      months: row.months.map((m) => ({
        month: m.monthBn,
        weatherIcon: m.weatherIcon,
        recommendedCropBn: m.recommendedCropBn,
        tempC: m.tempC ?? undefined,
        precipMm: m.precipMm ?? undefined,
        cropSlug: m.cropSlug ?? undefined,
        plantingWindowBn: m.plantingWindowBn ?? undefined,
        harvestWindowBn: m.harvestWindowBn ?? undefined,
        reasonBn: m.reasonBn ?? undefined,
      })),
    };
  }
}

const bn = (n: number | undefined) =>
  n === undefined ? '—' : new Intl.NumberFormat('bn-BD').format(n);

function reasonFromWeather(m: MonthOutlook) {
  const rain = m.precipMm ?? 0;
  const feel =
    rain >= 220 ? 'ভারী বৃষ্টি' : rain >= 100 ? 'মাঝারি বৃষ্টি' : 'কম বৃষ্টি';
  return `${inMonthBn(m.monthBn)} ${feel} (${bn(m.precipMm)} মিমি), গড় ${bn(m.tempC)}° — ${m.recommendedCropBn} উপযোগী।`;
}

function fallbackRecommendation(locationBn: string, months: PlannedMonth[]) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const m of months) {
    if (seen.has(m.cropSlug)) continue;
    seen.add(m.cropSlug);
    lines.push(
      `${m.recommendedCropBn}: ${m.plantingWindowBn} রোপণ, ${m.harvestWindowBn} নাগাদ কাটা।`,
    );
  }
  return [
    `${locationBn} এলাকার আগামী ${bn(months.length)} মাসের আবহাওয়া অনুযায়ী পরিকল্পনা।`,
    ...lines.slice(0, 4),
    'বৃষ্টির মাসে নালা পরিষ্কার রাখুন, শুকনো মাসে সেচের ব্যবস্থা রাখুন।',
  ].join(' ');
}
