import { Injectable } from '@nestjs/common';
import { LoanStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

type UserWithLookups = Prisma.UserGetPayload<{
  include: { role: true; profession: true; district: true };
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
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

  async listLoans(cursor?: string, limit = 20) {
    const take = Math.min(limit, 50);
    const rows = await this.prisma.loanApplication.findMany({
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        purpose: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    return rows.map((loan) => ({
      id: loan.id,
      amountBdt: loan.amountBdt,
      status: loan.status,
      repaymentPeriod: loan.repaymentPeriod,
      nextPaymentDue: loan.nextPaymentDue?.toISOString() ?? null,
      createdAt: loan.createdAt.toISOString(),
      purpose: {
        id: loan.purpose.id,
        nameBn: loan.purpose.nameBn,
      },
      user: loan.user,
    }));
  }

  async patchLoanStatus(actor: AuthUser, loanId: string, status: LoanStatus) {
    const loan = await this.prisma.loanApplication.update({
      where: { id: loanId },
      data: { status },
      include: {
        purpose: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'LOAN_STATUS_CHANGE',
        target: loanId,
        metadata: { status },
      },
    });
    return {
      id: loan.id,
      amountBdt: loan.amountBdt,
      status: loan.status,
      repaymentPeriod: loan.repaymentPeriod,
      nextPaymentDue: loan.nextPaymentDue?.toISOString() ?? null,
      createdAt: loan.createdAt.toISOString(),
      purpose: {
        id: loan.purpose.id,
        nameBn: loan.purpose.nameBn,
      },
      user: loan.user,
    };
  }
}
