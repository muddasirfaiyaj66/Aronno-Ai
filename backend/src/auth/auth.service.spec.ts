import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { MailService } from '../mail/mail.service';
import { REFRESH_REUSE_GRACE_MS } from '../common/constants';
import { sha256 } from '../common/crypto.util';

describe('AuthService.refresh', () => {
  const user = { id: 'user1', isActive: true, role: { slug: 'farmer' } };
  let prisma: {
    refreshToken: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tok1',
      userId: user.id,
      familyId: 'fam1',
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 86_400_000),
      user,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      refreshToken: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') };
    const config = {
      get: jest.fn().mockReturnValue('false'),
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as PasswordService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      {} as MailService,
    );
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  it('rejects a missing refresh cookie', async () => {
    await expect(service.refresh(undefined, res as never, {})).rejects.toMatchObject({
      code: 'AUTH_INVALID',
    });
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown, expired, or inactive session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.refresh('raw', res as never, {})).rejects.toThrow();

    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      row({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.refresh('raw', res as never, {})).rejects.toThrow();

    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      row({ user: { ...user, isActive: false } }),
    );
    await expect(service.refresh('raw', res as never, {})).rejects.toThrow();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rotates a live refresh token and sets a new access cookie', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(row());
    await expect(service.refresh('raw-token', res as never, {})).resolves.toEqual({
      ok: true,
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256('raw-token') } }),
    );
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'tok1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user1', familyId: 'fam1' }),
      }),
    );
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user1', role: 'farmer' }),
      expect.objectContaining({ expiresIn: 7 * 24 * 60 * 60 }),
    );
    const names = res.cookie.mock.calls.map((call) => call[0]);
    expect(names).toEqual(['aronno_access', 'aronno_refresh', 'aronno_csrf']);
  });

  it('treats a just-rotated token as a retry and keeps the family', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      row({ revokedAt: new Date(Date.now() - 5_000) }),
    );
    await expect(service.refresh('raw', res as never, {})).resolves.toEqual({
      ok: true,
    });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('revokes the family when a rotated token is reused after the grace window', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      row({ revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000) }),
    );
    await expect(service.refresh('raw', res as never, {})).rejects.toThrow();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
