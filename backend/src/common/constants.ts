export const COOKIE = {
  ACCESS: 'aronno_access',
  REFRESH: 'aronno_refresh',
  CSRF: 'aronno_csrf',
} as const;

export const COOKIE_PATH = '/api';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MINUTES = 15;

export const PUBLIC_MUTATIONS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/google',
]);
