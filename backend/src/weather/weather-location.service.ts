import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_POINT,
  parseLatLon,
  pointFromDistrict,
  type GeoPoint,
} from './coords';

@Injectable()
export class WeatherLocationService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(
    userId: string,
    latRaw?: string | number,
    lonRaw?: string | number,
  ): Promise<GeoPoint> {
    const gps = parseLatLon(latRaw, lonRaw);
    if (gps) {
      return { ...gps, locationBn: 'আপনার অবস্থান' };
    }
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { district: true },
    });
    if (!me?.district) return DEFAULT_POINT;
    return pointFromDistrict(me.district.slug, me.district.nameBn);
  }
}
