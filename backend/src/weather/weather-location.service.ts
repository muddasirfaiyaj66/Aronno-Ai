import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_POINT,
  parseLatLon,
  pointFromDistrict,
  type GeoPoint,
} from './coords';

@Injectable()
export class WeatherLocationService {
  private readonly logger = new Logger(WeatherLocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async forUser(
    userId: string,
    latRaw?: string | number,
    lonRaw?: string | number,
  ): Promise<GeoPoint> {
    const gps = parseLatLon(latRaw, lonRaw);
    if (gps) {
      const locationBn = (await this.reverseLabel(gps.lat, gps.lon)) ?? 'আপনার অবস্থান';
      return { ...gps, locationBn };
    }
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { district: true },
    });
    if (!me?.district) return DEFAULT_POINT;
    return pointFromDistrict(me.district.slug, me.district.nameBn);
  }

  private async reverseLabel(lat: number, lon: number): Promise<string | null> {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}` +
        `&format=jsonv2&accept-language=bn`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Aronno/1.0 (https://aronno-api.vercel.app)',
          'Accept-Language': 'bn,en',
        },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        name?: string;
        address?: Record<string, string>;
      };
      const a = json.address ?? {};
      return (
        a.state_district ||
        a.county ||
        a.city_district ||
        a.city ||
        a.town ||
        a.village ||
        a.state ||
        json.name ||
        null
      );
    } catch (err) {
      this.logger.warn(`Reverse geocode skipped: ${String(err)}`);
      return null;
    }
  }
}
