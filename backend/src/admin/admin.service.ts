import { Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async listUsers(cursor?: string, limit = 20) {
    const users = await this.prisma.user.findMany({
      take: Math.min(limit, 50),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { role: true, profession: true, district: true },
    });
    return users.map((u) => this.auth.toDto(u));
  }

  async patchRole(actor: AuthUser, userId: string, roleSlug: string) {
    if (roleSlug === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
      throw Errors.forbidden();
    }
    const role = await this.prisma.role.findUnique({ where: { slug: roleSlug } });
    if (!role) throw Errors.notFound();
    await this.prisma.user.update({ where: { id: userId }, data: { roleId: role.id } });
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
    await this.prisma.user.update({ where: { id: userId }, data: { isActive } });
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

  async patchLoanStatus(actor: AuthUser, loanId: string, status: LoanStatus) {
    const loan = await this.prisma.loanApplication.update({
      where: { id: loanId },
      data: { status },
      include: { purpose: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'LOAN_STATUS_CHANGE',
        target: loanId,
        metadata: { status },
      },
    });
    return loan;
  }
}
