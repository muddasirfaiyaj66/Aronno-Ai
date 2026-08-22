import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Errors } from '../common/errors';

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
      throw Errors.validation({ professionSlug: 'unknown' });

    const district = input.districtSlug
      ? await this.prisma.district.findUnique({
          where: { slug: input.districtSlug },
        })
      : undefined;
    if (input.districtSlug && !district)
      throw Errors.validation({ districtSlug: 'unknown' });

    await this.prisma.user.update({
      where: { id },
      data: {
        displayName: input.displayName,
        phone: input.phone,
        professionId: profession?.id,
        districtId: district?.id,
        avatarUrl: input.avatarUrl,
      },
    });
    return this.auth.me(id);
  }
}
