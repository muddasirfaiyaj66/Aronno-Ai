import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Errors } from '../common/errors';
import { httpUrl } from '../common/schemas';
import type { AuthUser } from '../auth/auth.types';

const listingSchema = z
  .object({
    cropSlug: z.string().min(1),
    quantityBn: z.string().min(1),
    askingPricePerKg: z.coerce.number().positive(),
    districtSlug: z.string().min(1),
    imageUrl: httpUrl.optional(),
  })
  .strict();

type MarketPriceRow = Prisma.MarketPriceGetPayload<{
  include: { market: { include: { district: true } }; crop: true };
}>;

type ListingRow = Prisma.ListingGetPayload<{
  include: { crop: true; district: true; seller: true };
}>;

type MarketPriceEntry = {
  id: string;
  marketNameBn: string;
  district: string;
  cropType: string;
  pricePerMon: number;
  trend: string;
  changePercent: number;
};

@Controller('market')
export class MarketController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get('prices')
  async prices(
    @Query('cropSlug') cropSlug?: string,
    @Query('districtSlug') districtSlug?: string,
  ) {
    const crop = cropSlug
      ? await this.prisma.crop.findUnique({ where: { slug: cropSlug } })
      : null;
    const district = districtSlug
      ? await this.prisma.district.findUnique({ where: { slug: districtSlug } })
      : null;

    const latest = await this.prisma.marketPrice.findMany({
      where: {
        ...(crop ? { cropId: crop.id } : {}),
        ...(district ? { market: { districtId: district.id } } : {}),
      },
      include: { market: { include: { district: true } }, crop: true },
      orderBy: { capturedAt: 'desc' },
    });

    const seen = new Set<string>();
    const current: MarketPriceRow[] = [];
    for (const row of latest as MarketPriceRow[]) {
      const key = `${row.marketId}:${row.cropId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      current.push(row);
    }

    const entries: MarketPriceEntry[] = await Promise.all(
      current.map(async (row) => {
        const previous = await this.prisma.marketPrice.findFirst({
          where: {
            marketId: row.marketId,
            cropId: row.cropId,
            capturedAt: { lt: row.capturedAt },
          },
          orderBy: { capturedAt: 'desc' },
        });
        const prev = previous?.pricePerMon ?? row.pricePerMon;
        const diff = row.pricePerMon - prev;
        const changePercent =
          prev === 0 ? 0 : Math.round((Math.abs(diff) / prev) * 100);
        const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        return {
          id: row.id,
          marketNameBn: row.market.nameBn,
          district: row.market.district.slug,
          cropType: row.crop.slug,
          pricePerMon: row.pricePerMon,
          trend,
          changePercent,
        };
      }),
    );

    const best = entries.reduce(
      (m, e) => (e.pricePerMon > m ? e.pricePerMon : m),
      0,
    );
    return {
      markets: entries.map((e) => ({
        ...e,
        bestPrice: e.pricePerMon === best && best > 0,
      })),
      estimatedRevenueHero: best,
    };
  }

  @Get('listings')
  async listings(
    @Query('cropSlug') cropSlug?: string,
    @Query('districtSlug') districtSlug?: string,
    @Query('sort') sort?: 'price_asc' | 'price_desc',
  ) {
    const crop = cropSlug
      ? await this.prisma.crop.findUnique({ where: { slug: cropSlug } })
      : null;
    const district = districtSlug
      ? await this.prisma.district.findUnique({ where: { slug: districtSlug } })
      : null;
    const rows: ListingRow[] = await this.prisma.listing.findMany({
      where: {
        isActive: true,
        ...(crop ? { cropId: crop.id } : {}),
        ...(district ? { districtId: district.id } : {}),
      },
      include: { crop: true, district: true, seller: true },
      orderBy: { askingPricePerKg: sort === 'price_desc' ? 'desc' : 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      cropType: row.crop.slug,
      cropNameBn: row.crop.nameBn,
      quantityBn: row.quantityBn,
      askingPriceBn: `৳ ${row.askingPricePerKg}/কেজি`,
      askingPricePerKg: row.askingPricePerKg,
      district: row.district.slug,
      sellerNameBn: row.seller.displayName,
      thumbnailUrl: row.thumbnailObjectKey
        ? this.storage.urlFor(row.thumbnailObjectKey)
        : undefined,
    }));
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('listings')
  async createListing(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(listingSchema)) body: z.infer<typeof listingSchema>,
  ) {
    const crop = await this.prisma.crop.findUnique({
      where: { slug: body.cropSlug },
    });
    const district = await this.prisma.district.findUnique({
      where: { slug: body.districtSlug },
    });
    if (!crop || !district) throw Errors.notFound();
    const row = await this.prisma.listing.create({
      data: {
        sellerUserId: user.id,
        cropId: crop.id,
        districtId: district.id,
        quantityBn: body.quantityBn,
        askingPricePerKg: body.askingPricePerKg,
        thumbnailObjectKey: body.imageUrl,
      },
      include: { crop: true, district: true, seller: true },
    });
    return {
      id: row.id,
      cropType: row.crop.slug,
      cropNameBn: row.crop.nameBn,
      quantityBn: row.quantityBn,
      askingPriceBn: `৳ ${row.askingPricePerKg}/কেজি`,
      askingPricePerKg: row.askingPricePerKg,
      district: row.district.slug,
      sellerNameBn: row.seller.displayName,
      thumbnailUrl: row.thumbnailObjectKey
        ? this.storage.urlFor(row.thumbnailObjectKey)
        : undefined,
    };
  }

  @Post('listings/:id/share')
  share(@Param('id') id: string) {
    return { shareUrl: `https://aronno.app/market/${id}` };
  }

  @Get('heatmap')
  async heatmap() {
    // TODO(product): data source needs product confirmation
    // (disease-report aggregation vs. price-index aggregation).
    const stats = await this.prisma.heatMapStat.findMany({
      include: { district: true },
      orderBy: { capturedAt: 'desc' },
    });
    const seen = new Set<string>();
    const regions = [];
    for (const s of stats) {
      if (seen.has(s.districtId)) continue;
      seen.add(s.districtId);
      regions.push({
        id: s.id,
        district: s.district.slug,
        diseaseIntensity: s.diseaseIntensity,
        priceIntensity: s.priceIntensity,
      });
    }
    return { regions };
  }
}
