import type { CookieOptions, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ACCESS_TTL_SECONDS,
  COOKIE,
  COOKIE_PATH,
  REFRESH_TTL_SECONDS,
} from './constants';

export function cookieBase(config: ConfigService): CookieOptions {
  const vercel = process.env.VERCEL === '1';
  const secure =
    config.get<string>('COOKIE_SECURE', vercel ? 'true' : 'false') === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'strict' : 'lax',
    path: COOKIE_PATH,
  };
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
  csrfToken: string,
) {
  const base = cookieBase(config);
  res.cookie(COOKIE.ACCESS, accessToken, {
    ...base,
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE.REFRESH, refreshToken, {
    ...base,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE.CSRF, csrfToken, {
    ...base,
    httpOnly: false,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response, config: ConfigService) {
  const base = cookieBase(config);
  res.clearCookie(COOKIE.ACCESS, base);
  res.clearCookie(COOKIE.REFRESH, base);
  res.clearCookie(COOKIE.CSRF, { ...base, httpOnly: false });
}
