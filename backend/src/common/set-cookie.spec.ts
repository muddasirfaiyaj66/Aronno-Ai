import {
  parseSetCookie,
  splitCombinedSetCookie,
} from '../../../mobile/services/cookieParse';

describe('phone cookie jar', () => {
  it('does not split a Set-Cookie header on the comma inside Expires', () => {
    const header = [
      'aronno_access=access-jwt; Max-Age=604800; Path=/api; Expires=Wed, 07 Oct 2026 12:00:00 GMT; HttpOnly',
      'aronno_refresh=refresh-raw; Max-Age=2592000; Path=/api; Expires=Wed, 30 Oct 2026 12:00:00 GMT; HttpOnly',
    ].join(', ');
    const parts = splitCombinedSetCookie(header);
    expect(parts).toHaveLength(2);
    expect(parseSetCookie(parts[0])?.name).toBe('aronno_access');
    expect(parseSetCookie(parts[1])?.name).toBe('aronno_refresh');
    expect(parseSetCookie(parts[1])?.value).toBe('refresh-raw');
    expect(parseSetCookie(parts[0])?.expires).toBeGreaterThan(Date.now());
  });
});
