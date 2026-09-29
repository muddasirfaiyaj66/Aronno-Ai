import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { RoomsService } from './rooms.service';

@Controller('v1')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Post('rooms')
  open(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { consultId?: string },
  ) {
    return this.rooms.open(authorization, body.consultId ?? '');
  }

  @Post('rooms/:consultId/close')
  close(
    @Headers('authorization') authorization: string | undefined,
    @Param('consultId') consultId: string,
  ) {
    return this.rooms.close(authorization, consultId);
  }

  @Post('rooms/:consultId/join')
  join(@Param('consultId') consultId: string, @Headers('cookie') cookie: string | undefined) {
    return this.rooms.join(consultId, cookie);
  }

  @Post('rooms/:consultId/leave')
  leave(@Param('consultId') consultId: string, @Headers('cookie') cookie: string | undefined) {
    return this.rooms.leave(consultId, cookie);
  }

  @Post('livekit/webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
    return this.rooms.webhook(raw, authorization);
  }
}
