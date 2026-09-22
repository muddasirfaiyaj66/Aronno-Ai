import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from './demo-account';
import { BANGLADESH_DISTRICTS } from '../lookups/bangladesh-districts';

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
  {
    slug: 'extension_officer',
    nameBn: 'সম্প্রসারণ কর্মকর্তা',
    nameEn: 'Extension officer',
  },
  { slug: 'other', nameBn: 'অন্যান্য', nameEn: 'Other' },
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
    for (const row of BANGLADESH_DISTRICTS) {
      await this.prisma.district.upsert({
        where: { slug: row.slug },
        update: { nameBn: row.nameBn },
        create: { slug: row.slug, nameBn: row.nameBn },
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
    await this.seedDemoUser();
    this.logger.log('Lookup seed complete');
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

    const email = this.config
      .get<string>('SUPERADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const password = this.config.get<string>('SUPERADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn(
        'SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD missing in env — skipped superadmin seed',
      );
      return;
    }
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) return;

    const name =
      this.config.get<string>('SUPERADMIN_NAME')?.trim() || 'Aronno Superadmin';
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

  private async seedDemoUser() {
    const userRole = await this.prisma.role.findUnique({
      where: { slug: 'USER' },
    });
    const farmer = await this.prisma.profession.findUnique({
      where: { slug: 'farmer' },
    });
    const jashore = await this.prisma.district.findUnique({
      where: { slug: 'jashore' },
    });
    const rice = await this.prisma.crop.findUnique({ where: { slug: 'rice' } });
    const potato = await this.prisma.crop.findUnique({
      where: { slug: 'potato' },
    });
    const seedPurpose = await this.prisma.loanPurpose.findUnique({
      where: { slug: 'fertilizer' },
    });
    if (!userRole || !farmer || !jashore || !rice || !potato || !seedPurpose)
      return;

    let user = await this.prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
    });
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            email: DEMO_EMAIL,
            passwordHash: await this.passwords.hash(DEMO_PASSWORD),
            displayName: DEMO_NAME,
            roleId: userRole.id,
            professionId: farmer.id,
            districtId: jashore.id,
            emailVerifiedAt: new Date(),
          },
        });
        this.logger.log(`Seeded demo farmer ${DEMO_EMAIL}`);
      } catch (err) {
        user = await this.prisma.user.findUnique({
          where: { email: DEMO_EMAIL },
        });
        if (!user) throw err;
      }
    } else {
      const passwordOk = user.passwordHash
        ? await this.passwords
            .verify(user.passwordHash, DEMO_PASSWORD)
            .catch(() => false)
        : false;
      if (!passwordOk || !user.emailVerifiedAt) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(!passwordOk
              ? { passwordHash: await this.passwords.hash(DEMO_PASSWORD) }
              : {}),
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          },
        });
      }
    }

    const existing = await this.prisma.diagnosis.count({
      where: { userId: user.id },
    });
    if (existing > 0) return;

    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    const diagnosis = await this.prisma.diagnosis.create({
      data: {
        userId: user.id,
        cropId: rice.id,
        source: 'photo',
        diseaseNameBn: 'বাদামি দাগ রোগ',
        diseaseNameEn: 'Brown Spot Disease',
        confidence: 87,
        severity: 'medium',
        createdAt: daysAgo(8),
      },
    });
    await this.prisma.historyEvent.create({
      data: {
        userId: user.id,
        kind: 'disease',
        sourceId: diagnosis.id,
        occurredAt: daysAgo(8),
      },
    });

    const plan = await this.prisma.treatmentPlan.create({
      data: {
        diagnosisId: diagnosis.id,
        userId: user.id,
        pesticideNameBn: 'প্রোপিকোনাজল ২৫% ইসি',
        dosagePerBigha: '৫০ মিলি/বিঘা',
        followUpLabelBn: '৭ দিন পর আবার দেখুন',
      },
    });
    await this.prisma.weatherAdvisory.create({
      data: {
        treatmentPlanId: plan.id,
        level: 'caution',
        reasonBn: 'আজ বিকেলে হালকা বৃষ্টির সম্ভাবনা আছে, সকালে স্প্রে করুন।',
      },
    });
    await this.prisma.treatmentStep.createMany({
      data: [
        {
          treatmentPlanId: plan.id,
          step: 1,
          instructionBn: '১৬ লিটার পানির সাথে ৫০ মিলি ওষুধ মেশান।',
        },
        {
          treatmentPlanId: plan.id,
          step: 2,
          instructionBn: 'মিশ্রণটি ভালোভাবে ঝাঁকিয়ে নিন।',
        },
        {
          treatmentPlanId: plan.id,
          step: 3,
          instructionBn: 'বিকেলে রোদ কম থাকা অবস্থায় পুরো পাতায় স্প্রে করুন।',
        },
        {
          treatmentPlanId: plan.id,
          step: 4,
          instructionBn: 'স্প্রে করার পর হাত ও মুখ ভালোভাবে ধুয়ে ফেলুন।',
        },
      ],
    });
    await this.prisma.safetyItem.createMany({
      data: [
        { treatmentPlanId: plan.id, labelBn: 'হাতে গ্লাভস পরুন', sortOrder: 0 },
        { treatmentPlanId: plan.id, labelBn: 'মুখে মাস্ক পরুন', sortOrder: 1 },
        {
          treatmentPlanId: plan.id,
          labelBn: 'শিশুদের ক্ষেত থেকে দূরে রাখুন',
          sortOrder: 2,
        },
      ],
    });

    await this.prisma.receipt.create({
      data: {
        userId: user.id,
        imageObjectKey:
          'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        totalBdt: 3200,
        summaryBn: 'মোট ৩,২০০ টাকা খরচ হয়েছে, যার মধ্যে সার ২,০০০ টাকা।',
        items: {
          create: [
            {
              nameBn: 'ইউরিয়া সার',
              quantity: '২ ব্যাগ',
              priceBn: '৳ ২,০০০',
              sortOrder: 0,
            },
            {
              nameBn: 'কীটনাশক',
              quantity: '১ বোতল',
              priceBn: '৳ ৮০০',
              sortOrder: 1,
            },
            {
              nameBn: 'বীজ',
              quantity: '৫ কেজি',
              priceBn: '৳ ৪০০',
              sortOrder: 2,
            },
          ],
        },
      },
    });

    await this.prisma.toolIdentification.create({
      data: {
        userId: user.id,
        source: 'voice',
        transcriptBn: 'ঘাস কাটার যন্ত্র দরকার',
        toolNameBn: 'ব্রাশ কাটার',
        toolNameEn: 'Brush Cutter',
        reasonBn:
          'ঘাস ও ছোট ঝোপ হাতে কাটার চেয়ে অনেক কম সময়ে পরিষ্কার করা যায়।',
        listings: {
          create: [
            {
              sourceName: 'দারাজ',
              thumbnailUrl: '',
              priceBn: '৳ ৪,৫০০',
              externalUrl: 'https://www.daraz.com.bd/',
            },
            {
              sourceName: 'স্থানীয় কৃষি দোকান',
              thumbnailUrl: '',
              priceBn: '৳ ৪,২০০',
              externalUrl: 'https://example.com/local-shop',
            },
          ],
        },
      },
    });

    await this.prisma.fertilizerAdvice.create({
      data: {
        userId: user.id,
        cropId: rice.id,
        growthStage: 'vegetative',
        soilColor: 'medium',
        soilMoisture: 'moist',
        landSizeBigha: 2,
        cropAgeDays: 25,
        hasDisease: 'no',
        fertilizerNameBn: 'ইউরিয়া ও টিএসপি মিশ্রণ',
        dosagePerBigha: '১৫ কেজি ইউরিয়া + ১০ কেজি টিএসপি প্রতি বিঘা',
        applicationMethodBn: 'মাটির সাথে সমানভাবে মিশিয়ে সারিতে প্রয়োগ করুন।',
        timingBn: 'রোপণের ১৫–২০ দিন পর সকালে প্রয়োগ করুন।',
        warningBn: 'অতিরিক্ত ইউরিয়া প্রয়োগ করবেন না।',
      },
    });

    const yieldRow = await this.prisma.yieldEstimate.create({
      data: {
        userId: user.id,
        cropId: rice.id,
        landSizeBn: '২ বিঘা',
        weatherSummaryBn: 'স্বাভাবিক বৃষ্টিপাত প্রত্যাশিত',
        estimatedMinMon: 32,
        estimatedMaxMon: 38,
        lastSeasonMon: 30,
        trend: 'up',
        changePercent: 15,
        createdAt: daysAgo(5),
      },
    });
    await this.prisma.historyEvent.create({
      data: {
        userId: user.id,
        kind: 'yield',
        sourceId: yieldRow.id,
        occurredAt: daysAgo(5),
      },
    });

    await this.prisma.cropPlan.create({
      data: {
        userId: user.id,
        recommendationBn:
          'শ্রাবণ ও ভাদ্রে আমন ধান উপযুক্ত। আশ্বিনে শাকসবজি, শীতে আলু, পৌষে সরিষা চাষ করা যায়।',
        months: {
          create: [
            {
              monthBn: 'শ্রাবণ',
              weatherIcon: 'rainy-outline',
              recommendedCropBn: 'আমন ধান',
              sortOrder: 0,
            },
            {
              monthBn: 'ভাদ্র',
              weatherIcon: 'rainy-outline',
              recommendedCropBn: 'আমন ধান',
              sortOrder: 1,
            },
            {
              monthBn: 'আশ্বিন',
              weatherIcon: 'partly-sunny-outline',
              recommendedCropBn: 'শাকসবজি',
              sortOrder: 2,
            },
            {
              monthBn: 'কার্তিক',
              weatherIcon: 'sunny-outline',
              recommendedCropBn: 'আলু',
              sortOrder: 3,
            },
            {
              monthBn: 'অগ্রহায়ণ',
              weatherIcon: 'sunny-outline',
              recommendedCropBn: 'আলু',
              sortOrder: 4,
            },
            {
              monthBn: 'পৌষ',
              weatherIcon: 'cloudy-outline',
              recommendedCropBn: 'সরিষা',
              sortOrder: 5,
            },
          ],
        },
      },
    });

    const loan = await this.prisma.loanApplication.create({
      data: {
        userId: user.id,
        amountBdt: 50000,
        purposeId: seedPurpose.id,
        repaymentPeriod: 'SIX_MONTHS',
        status: 'repaying',
        nextPaymentDue: daysAgo(-20),
        createdAt: daysAgo(12),
      },
    });
    await this.prisma.historyEvent.create({
      data: {
        userId: user.id,
        kind: 'loan',
        sourceId: loan.id,
        occurredAt: daysAgo(12),
      },
    });

    await this.prisma.listing.create({
      data: {
        sellerUserId: user.id,
        cropId: potato.id,
        districtId: jashore.id,
        quantityBn: '৫০০ কেজি',
        askingPricePerKg: 32,
        isActive: true,
      },
    });

    this.logger.log(`Seeded demo farm records for ${DEMO_EMAIL}`);
  }
}
