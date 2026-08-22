import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { Errors } from '../common/errors';
import { randomToken, sha256 } from '../common/crypto.util';
import {
  ACCESS_TTL_SECONDS,
  LOCKOUT_MINUTES,
  LOCKOUT_THRESHOLD,
  REFRESH_TTL_SECONDS,
} from '../common/constants';
import { clearAuthCookies, setAuthCookies } from '../common/cookies';
import { MailService } from '../mail/mail.service';
import type { AuthUser } from './auth.types';
import { EmailTokenPurpose } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { otpTokenHash } from './otp.util';

export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  role: { slug: string; nameBn: string; nameEn: string };
  profession: { slug: string; nameBn: string; nameEn: string } | null;
  district: { slug: string; nameBn: string } | null;
};

const userInclude = {
  role: true,
  profession: true,
  district: true,
} as const;

@Injectable()
export class AuthService {
  private google: OAuth2Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.google = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  toDto(user: {
    id: string;
    email: string;
    displayName: string;
    phone: string | null;
    isActive: boolean;
    emailVerifiedAt: Date | null;
    role: { slug: string; nameBn: string; nameEn: string };
    profession: { slug: string; nameBn: string; nameEn: string } | null;
    district: { slug: string; nameBn: string } | null;
    avatarUrl: string | null;
  }): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      role: {
        slug: user.role.slug,
        nameBn: user.role.nameBn,
        nameEn: user.role.nameEn,
      },
      profession: user.profession
        ? {
            slug: user.profession.slug,
            nameBn: user.profession.nameBn,
            nameEn: user.profession.nameEn,
          }
        : null,
      district: user.district
        ? { slug: user.district.slug, nameBn: user.district.nameBn }
        : null,
    };
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    professionSlug?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) throw Errors.conflict('এই ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে।');

    const userRole = await this.prisma.role.findUnique({
      where: { slug: 'USER' },
    });
    if (!userRole) throw Errors.notFound('রোল পাওয়া যায়নি।');

    const profession = input.professionSlug
      ? await this.prisma.profession.findUnique({
          where: { slug: input.professionSlug },
        })
      : null;

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await this.passwords.hash(input.password),
        displayName: input.displayName,
        roleId: userRole.id,
        professionId: profession?.id,
      },
      include: userInclude,
    });

    await this.sendOtp(user.id, user.email, 'verification');
    return { email: user.email, requiresVerification: true as const };
  }

  async login(
    input: { email: string; password: string },
    res: Response,
    meta: { userAgent?: string; ip?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: userInclude,
    });
    if (!user || !user.passwordHash) throw Errors.invalidCredentials();
    if (!user.isActive) throw Errors.forbidden();
    if (!user.emailVerifiedAt) {
      const recentlySent = await this.hasActiveOtp(user.id, 'verification');
      if (!recentlySent) {
        try {
          await this.sendOtp(user.id, user.email, 'verification');
        } catch {
          // still report unverified — user can resend on the verify screen
        }
      }
      throw Errors.unverified();
    }
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw Errors.locked();

    const ok = await this.passwords.verify(user.passwordHash, input.password);
    if (!ok) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil =
        failedLoginCount >= LOCKOUT_THRESHOLD
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount, lockedUntil },
      });
      if (lockedUntil) throw Errors.locked();
      throw Errors.invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    await this.issueSession(
      user.id,
      user.role.slug as AuthUser['role'],
      res,
      meta,
    );
    return this.toDto(user);
  }

  async verifyEmail(
    input: { email: string; code: string },
    res: Response,
    meta: { userAgent?: string; ip?: string },
  ) {
    const user = await this.consumeOtp(input.email, input.code, 'verification');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
      include: userInclude,
    });
    await this.issueSession(
      updated.id,
      updated.role.slug as AuthUser['role'],
      res,
      meta,
    );
    return this.toDto(updated);
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user && !user.emailVerifiedAt) {
      const recentlySent = await this.hasActiveOtp(user.id, 'verification');
      if (!recentlySent) {
        await this.sendOtp(user.id, user.email, 'verification');
      }
    }
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user?.passwordHash) {
      const recentlySent = await this.hasActiveOtp(user.id, 'password_reset');
      if (!recentlySent) {
        await this.sendOtp(user.id, user.email, 'password_reset');
      }
    }
    return { ok: true };
  }

  async resetPassword(input: {
    email: string;
    code: string;
    password: string;
  }) {
    const user = await this.consumeOtp(
      input.email,
      input.code,
      'password_reset',
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwords.hash(input.password),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async sendOtp(
    userId: string,
    email: string,
    purpose: EmailTokenPurpose,
  ) {
    const code = String(randomInt(100000, 1000000));
    const tokenHash = otpTokenHash(userId, purpose, code);
    const token = await this.prisma.emailToken.create({
      data: {
        userId,
        purpose,
        tokenHash,
        usedAt: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    this.logger.log(
      `OTP send: userId=${userId} purpose=${purpose} code=${code} hash=${tokenHash.slice(0, 12)}… tokenId=${token.id}`,
    );

    try {
      if (purpose === 'verification') {
        await this.mail.sendOtp(
          email,
          'আরণ্য — ইমেইল যাচাই',
          code,
          'আপনার ইমেইল যাচাইয়ের কোড:',
        );
      } else {
        await this.mail.sendOtp(
          email,
          'আরণ্য — পাসওয়ার্ড রিসেট',
          code,
          'পাসওয়ার্ড রিসেটের কোড:',
        );
      }
    } catch (err) {
      await this.prisma.emailToken.delete({ where: { id: token.id } });
      throw err;
    }

    // NOTE: we intentionally do NOT invalidate older unused codes here.
    // Any code the user has in their inbox from the last 15 minutes should
    // work, so the user is never confused about "which email do I use?".
    // consumeOtp() marks the specific code as used on successful verification.
  }

  private isOtpTokenActive(token: {
    usedAt: Date | null;
    expiresAt: Date;
  }): boolean {
    return token.usedAt == null && token.expiresAt.getTime() > Date.now();
  }

  private async hasActiveOtp(
    userId: string,
    purpose: EmailTokenPurpose,
  ): Promise<boolean> {
    const RECENT_WINDOW_MS = 60 * 1000;
    const recent = await this.prisma.emailToken.findMany({
      where: {
        userId,
        purpose,
        expiresAt: { gt: new Date() },
        createdAt: { gt: new Date(Date.now() - RECENT_WINDOW_MS) },
      },
    });
    return recent.some((t) => this.isOtpTokenActive(t));
  }

  private async consumeOtp(
    email: string,
    code: string,
    purpose: EmailTokenPurpose,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });
    if (!user) {
      this.logger.warn(`OTP consume: no user for email=${email}`);
      throw Errors.otpInvalid();
    }
    const tokenHash = otpTokenHash(user.id, purpose, code);
    this.logger.log(
      `OTP consume: userId=${user.id} purpose=${purpose} rawCode=${JSON.stringify(code)} hash=${tokenHash.slice(0, 12)}…`,
    );

    // MongoDB omits unset optional fields; Prisma `usedAt: null` does not match
    // those documents. Fetch by hash, then validate used/expiry in application code.
    const candidates = await this.prisma.emailToken.findMany({
      where: {
        userId: user.id,
        purpose,
        tokenHash,
      },
      orderBy: { createdAt: 'desc' },
    });

    const token = candidates.find((t) => this.isOtpTokenActive(t));
    if (!token) {
      const allForUser = await this.prisma.emailToken.findMany({
        where: { userId: user.id, purpose },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          tokenHash: true,
          usedAt: true,
          createdAt: true,
          expiresAt: true,
        },
      });
      this.logger.warn(
        `OTP consume miss: userId=${user.id} recentTokens=${
          allForUser
            .map(
              (t) =>
                `${t.id}(hash=${t.tokenHash.slice(0, 12)}…,used=${t.usedAt?.toISOString() ?? 'unset'},exp=${t.expiresAt.toISOString()})`,
            )
            .join(', ') || '<none>'
        }`,
      );
      const expired = candidates.find(
        (t) => t.usedAt == null && t.expiresAt.getTime() <= Date.now(),
      );
      if (expired) throw Errors.otpExpired();
      throw Errors.otpInvalid();
    }
    await this.prisma.emailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    return user;
  }

  async googleLogin(
    idToken: string,
    res: Response,
    meta: { userAgent?: string; ip?: string },
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw Errors.aiUnavailable();

    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    try {
      const ticket = await this.google.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw Errors.unauthorized();
    }

    if (!payload.sub || !payload.email) throw Errors.unauthorized();

    const userRole = await this.prisma.role.findUnique({
      where: { slug: 'USER' },
    });
    if (!userRole) throw Errors.notFound();

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleSub: payload.sub },
          { email: payload.email.toLowerCase() },
        ],
      },
      include: userInclude,
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: payload.email.toLowerCase(),
          googleSub: payload.sub,
          displayName: payload.name || payload.email,
          roleId: userRole.id,
          emailVerifiedAt: payload.email_verified ? new Date() : new Date(),
        },
        include: userInclude,
      });
    } else if (!user.googleSub) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleSub: payload.sub,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
        include: userInclude,
      });
    }

    await this.prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: payload.sub,
        },
      },
      update: {},
      create: {
        userId: user.id,
        provider: 'google',
        providerAccountId: payload.sub,
      },
    });

    await this.issueSession(
      user.id,
      user.role.slug as AuthUser['role'],
      res,
      meta,
    );
    return this.toDto(user);
  }

  async refresh(
    refreshRaw: string | undefined,
    res: Response,
    meta: { userAgent?: string; ip?: string },
  ) {
    if (!refreshRaw) throw Errors.unauthorized();
    const tokenHash = sha256(refreshRaw);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });
    if (!stored) throw Errors.unauthorized();

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw Errors.unauthorized();
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw Errors.unauthorized();
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    await this.issueSession(
      stored.userId,
      stored.user.role.slug as AuthUser['role'],
      res,
      meta,
      stored.familyId,
    );
    return { ok: true };
  }

  async logout(refreshRaw: string | undefined, res: Response) {
    if (refreshRaw) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: sha256(refreshRaw) },
      });
      if (stored) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userInclude,
    });
    if (!user) throw Errors.notFound();
    return this.toDto(user);
  }

  private async issueSession(
    userId: string,
    role: AuthUser['role'],
    res: Response,
    meta: { userAgent?: string; ip?: string },
    familyId = randomToken(16),
  ) {
    const jti = randomToken(16);
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TTL_SECONDS,
      },
    );
    const refreshRaw = randomToken(32);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(refreshRaw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });
    setAuthCookies(res, this.config, accessToken, refreshRaw, randomToken(16));
  }
}
