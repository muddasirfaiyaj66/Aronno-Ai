import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Body } from '@nestjs/common';
import { googleSchema, loginSchema, registerSchema } from './auth.dto';
import type { AuthUser } from './auth.types';
import { COOKIE } from '../common/constants';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(req: Request) {
    return {
      userAgent: req.header('user-agent'),
      ip: req.ip,
    };
  }

  @Public()
  @Post('register')
  register(
    @Body(new ZodPipe(registerSchema)) body: ReturnType<typeof registerSchema.parse>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.register(body, res, this.meta(req));
  }

  @Public()
  @Post('login')
  login(
    @Body(new ZodPipe(loginSchema)) body: ReturnType<typeof loginSchema.parse>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(body, res, this.meta(req));
  }

  @Public()
  @Post('google')
  google(
    @Body(new ZodPipe(googleSchema)) body: ReturnType<typeof googleSchema.parse>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.googleLogin(body.idToken, res, this.meta(req));
  }

  @Public()
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refresh(req.cookies?.[COOKIE.REFRESH], res, this.meta(req));
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req.cookies?.[COOKIE.REFRESH], res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
