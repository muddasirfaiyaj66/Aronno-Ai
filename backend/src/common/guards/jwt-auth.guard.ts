import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { COOKIE } from '../constants';
import { Errors } from '../errors';
import type { AuthUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = req.cookies?.[COOKIE.ACCESS] as string | undefined;
    if (!token) throw Errors.unauthorized();

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role: AuthUser['role'];
      }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });
      if (!user || !user.isActive) throw Errors.unauthorized();
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role.slug as AuthUser['role'],
      };
      return true;
    } catch {
      throw Errors.unauthorized();
    }
  }
}
