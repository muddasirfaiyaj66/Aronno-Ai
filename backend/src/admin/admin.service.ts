import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';

type UserWithLookups = Prisma.UserGetPayload<{
  include: { role: true; profession: true; district: true };
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly notifications: NotificationsService,
  ) {}

  async createAdmin(
    actor: AuthUser,
    input: { email: string; password: string; displayName: string },
  ) {
    if (actor.role !== 'SUPERADMIN' && actor.role !== 'ADMIN') {
      throw Errors.forbidden();
    }

    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw Errors.conflict('এই ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে।');

    const adminRole = await this.prisma.role.findUnique({
      where: { slug: 'ADMIN' },
    });
    if (!adminRole) throw Errors.notFound('রোল পাওয়া যায়নি।');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await this.passwords.hash(input.password),
        displayName: input.displayName,
        roleId: adminRole.id,
        emailVerifiedAt: new Date(),
      },
      include: { role: true, profession: true, district: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'ADMIN_CREATED',
        target: user.id,
        metadata: { email: user.email },
      },
    });

    return this.auth.toDto(user);
  }

  async listUsers(cursor?: string, limit = 20) {
    const users: UserWithLookups[] = await this.prisma.user.findMany({
      take: Math.min(limit, 50),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { role: true, profession: true, district: true },
    });
    return users.map((u) => this.auth.toDto(u));
  }

  async patchRole(actor: AuthUser, userId: string, roleSlug: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!target) throw Errors.notFound();
    if (target.role.slug === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
      throw Errors.forbidden();
    }
    if (roleSlug === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
      throw Errors.forbidden();
    }
    const role = await this.prisma.role.findUnique({
      where: { slug: roleSlug },
    });
    if (!role) throw Errors.notFound();
    await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'USER_ROLE_CHANGE',
        target: userId,
        metadata: { roleSlug },
      },
    });
    return this.auth.me(userId);
  }

  async patchActive(actor: AuthUser, userId: string, isActive: boolean) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!target) throw Errors.notFound();
    if (target.role.slug === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
      throw Errors.forbidden();
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'USER_ACTIVE_CHANGE',
        target: userId,
        metadata: { isActive },
      },
    });
    return this.auth.me(userId);
  }

  async reviewSpecialist(
    actor: AuthUser,
    userId: string,
    decision: 'approve' | 'reject',
    note?: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, profession: true },
    });
    if (!target) throw Errors.notFound();
    if (target.role.slug === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
      throw Errors.forbidden();
    }
    const slug = target.profession?.slug;
    if (slug !== 'agronomist' && slug !== 'extension_officer') {
      throw Errors.validation(
        { professionSlug: slug ?? null },
        'কৃষিবিদ বা সম্প্রসারণ কর্মকর্তা ছাড়া বিশেষজ্ঞ অনুমোদন হয় না।',
      );
    }
    if (!target.specialistCertificateUrl || !target.specialistNidUrl) {
      throw Errors.validation(
        { documents: 'missing' },
        'সনদ ও এনআইডি ছবি ছাড়া অনুমোদন হয় না।',
      );
    }
    if (decision === 'reject' && !note) {
      throw Errors.validation(
        { note: 'required' },
        'বাতিলের কারণ লিখুন।',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        specialistApproved: decision === 'approve',
        specialistReviewStatus: decision === 'approve' ? 'approved' : 'rejected',
        specialistReviewNote: decision === 'approve' ? null : note,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'USER_SPECIALIST_CHANGE',
        target: userId,
        metadata: { decision, note: note ?? null },
      },
    });
    const approved = decision === 'approve';
    void this.notifications.send({
      userId,
      dedupeKey: `specialist-review:${decision}:${Date.now()}`,
      kind: 'consult',
      title: approved ? 'বিশেষজ্ঞ অনুমোদন হয়েছে' : 'বিশেষজ্ঞ অনুমোদন হয়নি',
      body: approved
        ? 'অ্যাপে থাকলে কৃষকরা আপনাকে অনলাইনে দেখবে। কলের অনুরোধ এলে পপআপ আসবে।'
        : note || 'সনদ বা এনআইডি আবার জমা দিন।',
      pathname: '/(root)/consult',
      priority: 'important',
      popup: true,
    });
    return this.auth.me(userId);
  }
}
