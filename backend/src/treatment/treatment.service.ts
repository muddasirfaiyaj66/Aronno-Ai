import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_TREATMENT, WEATHER } from '../ai/ai.tokens';
import type { AiTreatmentPort } from '../ai/ports';
import type { WeatherPort } from '../weather/weather.types';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';
import { WeatherLocationService } from '../weather/weather-location.service';

@Injectable()
export class TreatmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_TREATMENT) private readonly ai: AiTreatmentPort,
    @Inject(WEATHER) private readonly weather: WeatherPort,
    private readonly locations: WeatherLocationService,
  ) {}

  private dto(plan: {
    id: string;
    pesticideNameBn: string;
    dosagePerBigha: string;
    followUpLabelBn: string;
    diagnosis: { diseaseNameBn: string; crop: { nameBn: string } | null };
    weather: { level: string; reasonBn: string } | null;
    steps: { step: number; instructionBn: string }[];
    safety: { id: string; labelBn: string }[];
  }) {
    return {
      id: plan.id,
      cropNameBn: plan.diagnosis.crop?.nameBn ?? 'ধান',
      diseaseNameBn: plan.diagnosis.diseaseNameBn,
      pesticideNameBn: plan.pesticideNameBn,
      dosagePerBigha: plan.dosagePerBigha,
      steps: plan.steps.map((s) => ({ step: s.step, instructionBn: s.instructionBn })),
      safetyChecklist: plan.safety.map((s) => ({ id: s.id, labelBn: s.labelBn })),
      followUpLabelBn: plan.followUpLabelBn,
      weatherAdvisory: plan.weather
        ? { level: plan.weather.level, reasonBn: plan.weather.reasonBn }
        : { level: 'safe', reasonBn: '' },
    };
  }

  async getOrCreate(user: AuthUser, diagnosisId: string) {
    const include = {
      diagnosis: { include: { crop: true } },
      weather: true,
      steps: { orderBy: { step: 'asc' as const } },
      safety: { orderBy: { sortOrder: 'asc' as const } },
    };
    const existing = await this.prisma.treatmentPlan.findUnique({
      where: { diagnosisId },
      include,
    });
    if (existing) {
      if (existing.userId !== user.id && user.role === 'USER') throw Errors.forbidden();
      return this.dto(existing);
    }

    const diagnosis = await this.prisma.diagnosis.findUnique({
      where: { id: diagnosisId },
      include: { crop: true },
    });
    if (!diagnosis) throw Errors.notFound();
    if (diagnosis.userId !== user.id && user.role === 'USER') throw Errors.forbidden();

    const generated = await this.ai.plan(diagnosis.diseaseNameBn, diagnosis.severity);
    const point = await this.locations.forUser(user.id);
    const advisory = await this.weather.sprayAdvisory(point);

    const created = await this.prisma.withTransaction(async (tx) => {
      const plan = await tx.treatmentPlan.create({
        data: {
          diagnosisId,
          userId: user.id,
          pesticideNameBn: generated.pesticideNameBn,
          dosagePerBigha: generated.dosagePerBigha,
          followUpLabelBn: generated.followUpLabelBn,
        },
      });
      await tx.weatherAdvisory.create({
        data: {
          treatmentPlanId: plan.id,
          level: advisory.level,
          reasonBn: advisory.reasonBn,
        },
      });
      for (const step of generated.steps) {
        await tx.treatmentStep.create({
          data: {
            treatmentPlanId: plan.id,
            step: step.step,
            instructionBn: step.instructionBn,
          },
        });
      }
      for (const [i, labelBn] of generated.safety.entries()) {
        await tx.safetyItem.create({
          data: { treatmentPlanId: plan.id, labelBn, sortOrder: i },
        });
      }
      return tx.treatmentPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include,
      });
    });
    return this.dto(created);
  }
}
