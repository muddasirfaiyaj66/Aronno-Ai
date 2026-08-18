import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { TreatmentService } from './treatment.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import type { AuthUser } from '../auth/auth.types';

const querySchema = z
  .object({
    diagnosisId: z.string().min(1),
  })
  .strict();

@Controller('treatment-plans')
export class TreatmentController {
  constructor(private readonly treatment: TreatmentService) {}

  @Get()
  get(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(querySchema)) query: z.infer<typeof querySchema>,
  ) {
    return this.treatment.getOrCreate(user, query.diagnosisId);
  }
}
