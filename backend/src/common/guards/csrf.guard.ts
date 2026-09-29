import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { COOKIE, isServiceMutation } from '../constants';
import { Errors } from '../errors';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE.has(req.method.toUpperCase())) return true;
    const path = req.originalUrl.split('?')[0];
    if (isServiceMutation(path)) return true;

    const cookie = req.cookies?.[COOKIE.CSRF] as string | undefined;
    const header = req.header('x-csrf-token');
    if (!cookie || !header || cookie !== header) throw Errors.csrf();
    return true;
  }
}
