import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import type { AuthUser } from '../auth/auth.types';
import { ConsultService } from './consult.service';
import { adviceSchema, createConsultSchema, presenceSchema } from './consult.dto';

@Controller('consults')
export class ConsultController {
  constructor(private readonly consults: ConsultService) {}

  @Get('specialists')
  specialists(@CurrentUser() user: AuthUser) {
    return this.consults.listSpecialists(user.id);
  }

  @Post('presence')
  presence(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(presenceSchema)) body: { online: boolean },
  ) {
    return this.consults.setPresence(user, body.online);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createConsultSchema))
    body: { specialistId: string; problemText: string; diagnosisId?: string },
  ) {
    return this.consults.create(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.consults.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consults.get(user, id);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consults.accept(user, id);
  }

  @Post(':id/ring')
  ring(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consults.ring(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consults.cancel(user, id);
  }

  @Put(':id/advice')
  advice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(adviceSchema))
    body: { summaryBn: string; steps: string; medicines: { name: string; dose: string; howToApply: string }[] },
  ) {
    return this.consults.saveAdvice(user, id, body);
  }

  @Post(':id/pdf')
  pdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consults.pdf(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consults.remove(user, id);
  }
}
