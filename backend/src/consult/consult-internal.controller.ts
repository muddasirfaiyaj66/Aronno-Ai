import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { COOKIE } from '../common/constants';
import { ConsultService } from './consult.service';
import { callStatusSchema } from './consult.dto';

@Controller('internal/consults')
export class ConsultInternalController {
  constructor(private readonly consults: ConsultService) {}

  @Public()
  @Post(':id/join-check')
  joinCheck(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const access = req.cookies?.[COOKIE.ACCESS] as string | undefined;
    return this.consults.joinCheck(authorization, access, id);
  }

  @Public()
  @Post(':id/call-status')
  callStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body(new ZodPipe(callStatusSchema)) body: { status: 'in_call' | 'ended' },
  ) {
    return this.consults.setCallStatus(authorization, id, body.status);
  }
}
