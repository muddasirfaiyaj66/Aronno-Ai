export const COOKIE = {
  ACCESS: 'aronno_access',
  REFRESH: 'aronno_refresh',
  CSRF: 'aronno_csrf',
} as const;

export const COOKIE_PATH = '/api';

export const ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Longer than the access cookie so a 401 can still mint a new 7-day session. */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
/** A second refresh with the token just rotated is a retry, not theft. */
export const REFRESH_REUSE_GRACE_MS = 60_000;

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MINUTES = 15;

export const PUBLIC_MUTATIONS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/marketplace/payments/sslcommerz/success',
  '/api/marketplace/payments/sslcommerz/fail',
  '/api/marketplace/payments/sslcommerz/cancel',
  '/api/marketplace/payments/sslcommerz/ipn',
  '/marketplace/payments/sslcommerz/success',
  '/marketplace/payments/sslcommerz/fail',
  '/marketplace/payments/sslcommerz/cancel',
  '/marketplace/payments/sslcommerz/ipn',
]);

/** Call-service routes include a consult id, so they cannot be listed one by one. */
export function isServiceMutation(path: string) {
  if (PUBLIC_MUTATIONS.has(path)) return true;
  return path.startsWith('/api/internal/') || path.startsWith('/internal/');
}
