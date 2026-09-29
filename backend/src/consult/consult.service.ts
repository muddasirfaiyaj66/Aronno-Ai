import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ConsultStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { Errors } from '../common/errors';
import { COOKIE } from '../common/constants';
import type { AuthUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { CallClient } from './call-client';
import type { Medicine } from './consult.dto';
import { buildConsultPdf } from './consult-pdf';

const SPECIALIST_PROFESSIONS = ['agronomist', 'extension_officer'] as const;
const ONLINE_MS = 45_000;

const consultInclude = {
  farmer: { select: { id: true, displayName: true, email: true } },
  specialist: { select: { id: true, displayName: true, email: true } },
  advice: true,
} satisfies Prisma.ConsultInclude;

type ConsultRow = Prisma.ConsultGetPayload<{ include: typeof consultInclude }>;

@Injectable()
export class ConsultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly calls: CallClient,
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async listSpecialists(viewerId: string) {
    const people = await this.prisma.user.findMany({
      where: {
        id: { not: viewerId },
        isActive: true,
        specialistApproved: true,
        profession: { slug: { in: [...SPECIALIST_PROFESSIONS] } },
      },
      include: { profession: true, district: true },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
    const now = Date.now();
    return people
      .map((person) => ({
        id: person.id,
        displayName: person.displayName,
        profession: person.profession?.nameBn ?? 'বিশেষজ্ঞ',
        district: person.district?.nameBn ?? null,
        avatarUrl: person.avatarUrl,
        online:
          person.specialistOnline &&
          !!person.specialistLastSeenAt &&
          now - person.specialistLastSeenAt.getTime() < ONLINE_MS,
      }))
      .sort((a, b) => Number(b.online) - Number(a.online));
  }

  async setPresence(user: AuthUser, online: boolean) {
    if (!(await this.isApprovedSpecialist(user.id))) throw Errors.forbidden();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        specialistOnline: online,
        specialistLastSeenAt: online ? new Date() : undefined,
      },
    });
    return { online };
  }

  async create(user: AuthUser, input: { specialistId: string; problemText: string; diagnosisId?: string }) {
    if (input.specialistId === user.id) throw Errors.forbidden();
    const specialist = await this.prisma.user.findUnique({
      where: { id: input.specialistId },
      include: { profession: true },
    });
    if (
      !specialist?.isActive ||
      !specialist.specialistApproved ||
      !SPECIALIST_PROFESSIONS.includes(
        specialist.profession?.slug as (typeof SPECIALIST_PROFESSIONS)[number],
      )
    ) {
      throw Errors.validation({ specialistId: input.specialistId }, 'এই বিশেষজ্ঞ এখন নেই।');
    }
    if (input.diagnosisId) {
      const diagnosis = await this.prisma.diagnosis.findUnique({
        where: { id: input.diagnosisId },
      });
      if (!diagnosis || diagnosis.userId !== user.id) throw Errors.notFound('রোগ নির্ণয় পাওয়া যায়নি।');
    }
    const open = await this.prisma.consult.findFirst({
      where: {
        farmerId: user.id,
        specialistId: input.specialistId,
        status: { in: ['requested', 'accepted', 'ringing', 'in_call'] },
      },
    });
    if (open) throw Errors.conflict('এই বিশেষজ্ঞের কাছে আগের অনুরোধ এখনো খোলা আছে।');
    const consult = await this.prisma.consult.create({
      data: {
        farmerId: user.id,
        specialistId: input.specialistId,
        problemText: input.problemText,
        diagnosisId: input.diagnosisId,
      },
      include: consultInclude,
    });
    void this.notifySpecialist(consult);
    void this.notifications.send({
      userId: input.specialistId,
      dedupeKey: `consult-request:${consult.id}`,
      kind: 'consult',
      title: 'নতুন কলের অনুরোধ',
      body: `${consult.farmer.displayName}: ${input.problemText.slice(0, 180)}`,
      pathname: `/(root)/consult/${consult.id}`,
      priority: 'important',
      popup: true,
    });
    return this.toDto(consult);
  }

  async list(user: AuthUser) {
    const specialist = await this.isApprovedSpecialist(user.id);
    if (specialist) {
      const items = await this.prisma.consult.findMany({
        where: { specialistId: user.id },
        include: consultInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return { viewer: 'specialist' as const, items: items.map((row) => this.toDto(row)) };
    }
    const items = await this.prisma.consult.findMany({
      where: { farmerId: user.id },
      include: consultInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { viewer: 'farmer' as const, items: items.map((row) => this.toDto(row)) };
  }

  async get(user: AuthUser, id: string) {
    const row = await this.findRow(id);
    if (row.farmerId === user.id || row.specialistId === user.id) return this.toDto(row);
    throw Errors.forbidden();
  }

  async accept(user: AuthUser, id: string) {
    if (!(await this.isApprovedSpecialist(user.id))) throw Errors.forbidden();
    const row = await this.findRow(id);
    if (row.specialistId !== user.id) throw Errors.forbidden();
    if (row.status !== 'requested') throw Errors.conflict('এই পরামর্শ ইতিমধ্যে নেওয়া হয়েছে।');
    const updated = await this.prisma.consult.update({
      where: { id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
      include: consultInclude,
    });
    void this.notifications.send({
      userId: row.farmerId,
      dedupeKey: `consult-accepted:${id}`,
      kind: 'consult',
      title: 'অনুরোধ গৃহীত হয়েছে',
      body: `${updated.specialist?.displayName ?? 'বিশেষজ্ঞ'} আপনার অনুরোধ নিয়েছেন। কল এলে পপআপ আসবে।`,
      pathname: `/(root)/consult/${id}`,
      priority: 'important',
      popup: true,
    });
    return this.toDto(updated);
  }

  async ring(user: AuthUser, id: string) {
    if (!(await this.isApprovedSpecialist(user.id))) throw Errors.forbidden();
    const row = await this.findRow(id);
    if (row.specialistId !== user.id) throw Errors.forbidden();
    if (row.status !== 'accepted' && row.status !== 'ringing' && row.status !== 'in_call') {
      throw Errors.conflict('আগে অনুরোধটি গ্রহণ করুন।');
    }
    const updated = await this.prisma.consult.update({
      where: { id },
      data: { status: row.status === 'in_call' ? 'in_call' : 'ringing' },
      include: consultInclude,
    });
    const videoReady = await this.calls.openRoom(id);
    if (row.status !== 'in_call') {
      void this.notifications.send({
        userId: row.farmerId,
        dedupeKey: `consult-ring:${id}:${Date.now()}`,
        kind: 'consult',
        title: 'কল আসছে',
        body: `${updated.specialist?.displayName ?? 'বিশেষজ্ঞ'} আপনাকে কল করছেন।`,
        pathname: `/(root)/consult/${id}`,
        priority: 'emergency',
        popup: true,
      });
    }
    return { ...this.toDto(updated), videoReady };
  }

  async cancel(user: AuthUser, id: string) {
    const row = await this.findRow(id);
    const specialist = row.specialistId === user.id;
    const farmer = row.farmerId === user.id;
    if (!specialist && !farmer) throw Errors.forbidden();
    if (row.status === 'completed' || row.status === 'cancelled') {
      throw Errors.conflict('এই পরামর্শ বন্ধ করা যাবে না।');
    }
    const updated = await this.prisma.consult.update({
      where: { id },
      data: { status: 'cancelled', endedAt: new Date() },
      include: consultInclude,
    });
    await this.calls.closeRoom(id);
    return this.toDto(updated);
  }

  async saveAdvice(
    user: AuthUser,
    id: string,
    input: { summaryBn: string; steps: string; medicines: Medicine[] },
  ) {
    const row = await this.findRow(id);
    if (row.specialistId !== user.id) throw Errors.forbidden();
    if (row.status === 'cancelled' || row.status === 'requested') {
      throw Errors.conflict('পরামর্শ লেখার আগে কল গ্রহণ করুন।');
    }
    await this.prisma.consultAdvice.upsert({
      where: { consultId: id },
      create: {
        consultId: id,
        summaryBn: input.summaryBn,
        steps: input.steps,
        medicines: input.medicines,
      },
      update: {
        summaryBn: input.summaryBn,
        steps: input.steps,
        medicines: input.medicines,
      },
    });
    const updated = await this.prisma.consult.update({
      where: { id },
      data: { status: 'completed' },
      include: consultInclude,
    });
    await this.calls.closeRoom(id);
    return this.toDto(updated);
  }

  async pdf(user: AuthUser, id: string) {
    const row = await this.findRow(id);
    if (row.farmerId !== user.id && row.specialistId !== user.id) throw Errors.forbidden();
    if (!row.advice) throw Errors.notFound('পরামর্শ এখনো লেখা হয়নি।');
    const medicines = Array.isArray(row.advice.medicines)
      ? (row.advice.medicines as Medicine[])
      : [];
    const bytes = await buildConsultPdf({
      farmerName: row.farmer.displayName,
      specialistName: row.specialist?.displayName ?? 'কৃষি বিশেষজ্ঞ',
      problemText: row.problemText,
      summaryBn: row.advice.summaryBn,
      steps: row.advice.steps,
      medicines,
    });
    return {
      filename: `aronno-consult-${id.slice(-8)}.pdf`,
      pdfBase64: bytes.toString('base64'),
      downloadUrl: null as string | null,
    };
  }

  async joinCheck(headerSecret: string | undefined, accessCookie: string | undefined, id: string) {
    this.assertServiceSecret(headerSecret);
    if (!accessCookie) throw Errors.unauthorized();
    let userId = '';
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(accessCookie, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      userId = payload.sub;
    } catch {
      throw Errors.unauthorized();
    }
    const row = await this.findRow(id);
    const isFarmer = row.farmerId === userId;
    const isSpecialist = row.specialistId === userId;
    if (!isFarmer && !isSpecialist) throw Errors.forbidden();
    if (row.status !== 'ringing' && row.status !== 'in_call') {
      throw Errors.conflict('এই মুহূর্তে কলে যোগ দেওয়া যাবে না।');
    }
    const person = isFarmer ? row.farmer : row.specialist;
    return {
      userId,
      displayName: person?.displayName ?? 'আরণ্য',
      side: isFarmer ? 'farmer' : 'specialist',
    };
  }

  async setCallStatus(headerSecret: string | undefined, id: string, status: 'in_call' | 'ended') {
    this.assertServiceSecret(headerSecret);
    const row = await this.findRow(id);
    if (row.status === 'completed' || row.status === 'cancelled' || row.status === 'requested') {
      return this.toDto(row);
    }
    if (
      status === 'in_call' &&
      row.status !== 'ringing' &&
      row.status !== 'accepted' &&
      row.status !== 'in_call'
    ) {
      return this.toDto(row);
    }
    const updated = await this.prisma.consult.update({
      where: { id },
      data: {
        status,
        endedAt: status === 'ended' ? new Date() : row.endedAt,
      },
      include: consultInclude,
    });
    return this.toDto(updated);
  }

  private assertServiceSecret(header: string | undefined) {
    const expected = this.config.get<string>('CALL_SERVICE_SECRET') ?? '';
    const got = header?.replace(/^Bearer\s+/i, '') ?? '';
    const a = Buffer.from(expected);
    const b = Buffer.from(got);
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw Errors.unauthorized();
    }
  }

  private async isApprovedSpecialist(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profession: true },
    });
    if (!user?.specialistApproved || !user.isActive) return false;
    return SPECIALIST_PROFESSIONS.includes(
      user.profession?.slug as (typeof SPECIALIST_PROFESSIONS)[number],
    );
  }

  private async findRow(id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw Errors.notFound();
    const row = await this.prisma.consult.findUnique({
      where: { id },
      include: consultInclude,
    });
    if (!row) throw Errors.notFound();
    return row;
  }

  private toDto(row: ConsultRow) {
    const medicines = Array.isArray(row.advice?.medicines)
      ? (row.advice.medicines as Medicine[])
      : [];
    return {
      id: row.id,
      status: row.status as ConsultStatus,
      problemText: row.problemText,
      diagnosisId: row.diagnosisId,
      farmer: { id: row.farmer.id, displayName: row.farmer.displayName },
      specialist: row.specialist
        ? { id: row.specialist.id, displayName: row.specialist.displayName }
        : null,
      advice: row.advice
        ? {
            summaryBn: row.advice.summaryBn,
            steps: row.advice.steps,
            medicines,
          }
        : null,
      videoReady: this.calls.configured && (row.status === 'ringing' || row.status === 'in_call'),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async notifySpecialist(row: ConsultRow) {
    const email = row.specialist?.email;
    if (!email) return;
    await this.mail.send({
      to: email,
      subject: 'নতুন কৃষি পরামর্শের অনুরোধ',
      title: 'একজন কৃষক আপনাকে কল করতে চান',
      intro: `${row.farmer.displayName} আপনাকে বেছে অনুরোধ পাঠিয়েছেন। অ্যাপে গিয়ে গ্রহণ করে কল করুন।`,
      details: [{ label: 'সমস্যা', value: row.problemText.slice(0, 280) }],
    });
  }
}

export const ACCESS_COOKIE = COOKIE.ACCESS;
