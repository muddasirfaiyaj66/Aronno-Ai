import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Errors } from '../common/errors';

const SPECIALIST_PROFESSIONS = new Set(['agronomist', 'extension_officer']);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  me(id: string) {
    return this.auth.me(id);
  }

  async patchMe(
    id: string,
    input: {
      displayName?: string;
      phone?: string;
      professionSlug?: string;
      districtSlug?: string;
      avatarUrl?: string;
    },
  ) {
    const profession = input.professionSlug
      ? await this.prisma.profession.findUnique({
          where: { slug: input.professionSlug },
        })
      : undefined;
    if (input.professionSlug && !profession)
      throw Errors.validation(
        { professionSlug: 'unknown' },
        'পেশা সঠিক নয়। তালিকা থেকে বেছে নিন।',
      );

    const district = input.districtSlug
      ? await this.prisma.district.findUnique({
          where: { slug: input.districtSlug },
        })
      : undefined;
    if (input.districtSlug && !district)
      throw Errors.validation(
        { districtSlug: 'unknown' },
        'জেলা সঠিক নয়। তালিকা থেকে বেছে নিন।',
      );

    const leavingSpecialist =
      !!profession && !SPECIALIST_PROFESSIONS.has(profession.slug);

    await this.prisma.user.update({
      where: { id },
      data: {
        displayName: input.displayName,
        phone: input.phone,
        professionId: profession?.id,
        districtId: district?.id,
        avatarUrl: input.avatarUrl,
        ...(leavingSpecialist
          ? {
              specialistApproved: false,
              specialistReviewStatus: 'none' as const,
              specialistReviewNote: null,
            }
          : {}),
      },
    });
    return this.auth.me(id);
  }

  async submitSpecialistDocs(
    id: string,
    input: { certificateUrl: string; nidUrl: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profession: true },
    });
    if (!user) throw Errors.notFound();
    if (!user.profession || !SPECIALIST_PROFESSIONS.has(user.profession.slug)) {
      throw Errors.validation(
        { professionSlug: user.profession?.slug ?? null },
        'আগে পেশা কৃষিবিদ বা সম্প্রসারণ কর্মকর্তা হিসেবে সংরক্ষণ করুন।',
      );
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        specialistCertificateUrl: input.certificateUrl,
        specialistNidUrl: input.nidUrl,
        specialistReviewStatus: 'pending',
        specialistApproved: false,
        specialistReviewNote: null,
        specialistSubmittedAt: new Date(),
      },
    });
    return this.auth.me(id);
  }
}
