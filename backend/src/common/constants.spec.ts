import {
  ACCESS_TTL_SECONDS,
  REFRESH_REUSE_GRACE_MS,
  REFRESH_TTL_SECONDS,
} from './constants';

describe('session lifetimes', () => {
  it('keeps the access cookie for 7 days', () => {
    expect(ACCESS_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it('lets the refresh cookie outlive the access cookie', () => {
    expect(REFRESH_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(REFRESH_TTL_SECONDS).toBeGreaterThan(ACCESS_TTL_SECONDS);
  });

  it('allows a short retry after a refresh token is rotated', () => {
    expect(REFRESH_REUSE_GRACE_MS).toBe(60_000);
  });
});
