import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';

const ROLES = [
  { slug: 'SUPERADMIN', nameBn: 'সুপার অ্যাডমিন', nameEn: 'Superadmin' },
  { slug: 'ADMIN', nameBn: 'অ্যাডমিন', nameEn: 'Admin' },
  { slug: 'USER', nameBn: 'ব্যবহারকারী', nameEn: 'User' },
];

const PROFESSIONS = [
  { slug: 'farmer', nameBn: 'কৃষক', nameEn: 'Farmer' },
  { slug: 'shop_owner', nameBn: 'দোকান মালিক', nameEn: 'Shop owner' },
  { slug: 'agronomist', nameBn: 'কৃষিবিদ', nameEn: 'Agronomist' },
  { slug: 'trader', nameBn: 'ব্যবসায়ী', nameEn: 'Trader' },
  { slug: 'extension_officer', nameBn: 'সম্প্রসারণ কর্মকর্তা', nameEn: 'Extension officer' },
  { slug: 'other', nameBn: 'অন্যান্য', nameEn: 'Other' },
];

const DISTRICTS = [
  { slug: 'jashore', nameBn: 'যশোর' },
  { slug: 'munshiganj', nameBn: 'মুন্সিগঞ্জ' },
  { slug: 'bogura', nameBn: 'বগুড়া' },
  { slug: 'rangpur', nameBn: 'রংপুর' },
  { slug: 'comilla', nameBn: 'কুমিল্লা' },
];

const CROPS = [
  { slug: 'rice', nameBn: 'ধান', nameEn: 'Rice' },
  { slug: 'potato', nameBn: 'আলু', nameEn: 'Potato' },
  { slug: 'tomato', nameBn: 'টমেটো', nameEn: 'Tomato' },
  { slug: 'vegetable', nameBn: 'সবজি', nameEn: 'Vegetable' },
  { slug: 'onion', nameBn: 'পেঁয়াজ', nameEn: 'Onion' },
  { slug: 'corn', nameBn: 'ভুট্টা', nameEn: 'Corn' },
  { slug: 'lentil', nameBn: 'মসুর ডাল', nameEn: 'Lentil' },
];

const LOAN_PURPOSES = [
  { slug: 'seed', nameBn: 'বীজ' },
  { slug: 'fertilizer', nameBn: 'সার' },
  { slug: 'equipment', nameBn: 'যন্ত্র' },
  { slug: 'other', nameBn: 'অন্যান্য' },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    for (const row of ROLES) {
      await this.prisma.role.upsert({
        where: { slug: row.slug },
        update: { nameBn: row.nameBn, nameEn: row.nameEn },
        create: row,
      });
    }
    for (const row of PROFESSIONS) {
      await this.prisma.profession.upsert({
        where: { slug: row.slug },
        update: { nameBn: row.nameBn, nameEn: row.nameEn },
        create: row,
      });
    }
    for (const row of DISTRICTS) {
      await this.prisma.district.upsert({
        where: { slug: row.slug },
        update: { nameBn: row.nameBn },
        create: row,
      });
    }
    for (const row of CROPS) {
      await this.prisma.crop.upsert({
        where: { slug: row.slug },
        update: { nameBn: row.nameBn, nameEn: row.nameEn },
        create: row,
      });
    }
    for (const row of LOAN_PURPOSES) {
      await this.prisma.loanPurpose.upsert({
        where: { slug: row.slug },
        update: { nameBn: row.nameBn },
        create: row,
      });
    }

    await this.seedSuperadmin();
    await this.seedMarket();
    await this.logger.log('Lookup seed complete');
  }

  private async seedSuperadmin() {
    const superRole = await this.prisma.role.findUnique({
      where: { slug: 'SUPERADMIN' },
    });
    if (!superRole) return;

    const existingRoleUser = await this.prisma.user.findFirst({
      where: { roleId: superRole.id },
    });
    if (existingRoleUser) return;

    const email = this.config.get<string>(
      'SUPERADMIN_EMAIL',
      'superadmin@aronno.local',
    ).toLowerCase();
    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) return;

    const password = this.config.get<string>(
      'SUPERADMIN_PASSWORD',
      'ChangeMe_Admin1!',
    );
    const name = this.config.get<string>('SUPERADMIN_NAME', 'Aronno Superadmin');
    const farmer = await this.prisma.profession.findUnique({
      where: { slug: 'farmer' },
    });
    const jashore = await this.prisma.district.findUnique({
      where: { slug: 'jashore' },
    });

    await this.prisma.user.create({
      data: {
        email,
        passwordHash: await this.passwords.hash(password),
        displayName: name,
        roleId: superRole.id,
        professionId: farmer?.id,
        districtId: jashore?.id,
        emailVerifiedAt: new Date(),
      },
    });
    this.logger.log(`Seeded SUPERADMIN ${email}`);
  }

  private async seedMarket() {
    const districts = await this.prisma.district.findMany();
    const crops = await this.prisma.crop.findMany();
    if (!districts.length || !crops.length) return;

    const marketNames: Record<string, string> = {
      jashore: 'যশোর বাজার',
      munshiganj: 'মুন্সিগঞ্জ বাজার',
      bogura: 'বগুড়া বাজার',
      rangpur: 'রংপুর বাজার',
      comilla: 'কুমিল্লা বাজার',
    };

    for (const d of districts) {
      const existing = await this.prisma.market.findFirst({
        where: { districtId: d.id },
      });
      if (!existing) {
        await this.prisma.market.create({
          data: { nameBn: marketNames[d.slug] ?? d.nameBn, districtId: d.id },
        });
      }
      const heat = await this.prisma.heatMapStat.findFirst({
        where: { districtId: d.id },
      });
      if (!heat) {
        await this.prisma.heatMapStat.create({
          data: {
            districtId: d.id,
            diseaseIntensity: Math.round((0.2 + Math.random() * 0.6) * 100) / 100,
            priceIntensity: Math.round((0.2 + Math.random() * 0.6) * 100) / 100,
          },
        });
      }
    }

    const priceCount = await this.prisma.marketPrice.count();
    if (priceCount === 0) {
      const markets = await this.prisma.market.findMany({ include: { district: true } });
      const seedPrices: { crop: string; district: string; price: number }[] = [
        { crop: 'rice', district: 'jashore', price: 1180 },
        { crop: 'rice', district: 'bogura', price: 1120 },
        { crop: 'rice', district: 'rangpur', price: 1095 },
        { crop: 'potato', district: 'munshiganj', price: 640 },
        { crop: 'potato', district: 'comilla', price: 590 },
        { crop: 'tomato', district: 'bogura', price: 980 },
        { crop: 'tomato', district: 'jashore', price: 910 },
        { crop: 'vegetable', district: 'comilla', price: 720 },
        { crop: 'onion', district: 'rangpur', price: 1450 },
        { crop: 'onion', district: 'munshiganj', price: 1380 },
        { crop: 'corn', district: 'bogura', price: 860 },
        { crop: 'corn', district: 'rangpur', price: 905 },
        { crop: 'lentil', district: 'jashore', price: 2150 },
        { crop: 'lentil', district: 'comilla', price: 2260 },
      ];
      for (const row of seedPrices) {
        const crop = crops.find((c) => c.slug === row.crop);
        const market = markets.find((m) => m.district.slug === row.district);
        if (!crop || !market) continue;
        await this.prisma.marketPrice.create({
          data: {
            marketId: market.id,
            cropId: crop.id,
            pricePerMon: row.price,
            capturedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          },
        });
        await this.prisma.marketPrice.create({
          data: {
            marketId: market.id,
            cropId: crop.id,
            pricePerMon: row.price,
          },
        });
      }
    }
  }
}
