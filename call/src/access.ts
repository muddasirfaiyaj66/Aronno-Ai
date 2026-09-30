import { timingSafeEqual } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

export function assertServiceSecret(authorization: string | undefined, expected: string) {
  const got = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException();
  }
}

export function assertConsultId(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new BadRequestException('Invalid consult');
}

export function readJoinCheck(status: number, body: unknown): { userId: string; displayName: string } {
  const payload = body as
    | { success: true; data: { userId: string; displayName: string } }
    | { success: false }
    | null;
  if (status >= 500) throw new ServiceUnavailableException('API did not respond');
  if (
    status >= 200 &&
    status < 300 &&
    payload &&
    'success' in payload &&
    payload.success &&
    payload.data?.userId
  ) {
    return payload.data;
  }
  if (status === 401 || status === 403) {
    throw new UnauthorizedException('Join check rejected');
  }
  throw new BadRequestException('Join check failed');
}
