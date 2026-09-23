import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SprayLevel } from '@prisma/client';
import { Errors } from '../common/errors';
import type { GeoPoint } from './coords';
import {
  conditionBn,
  conditionEn,
  iconFromKind,
  kindFromPrecipMm,
  kindFromWmo,
} from './wmo';
import type {
  CurrentWeather,
  MonthOutlook,
  OutlookSource,
  WeatherPort,
} from './weather.types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const SEASONAL_URL = 'https://seasonal-api.open-meteo.com/v1/seasonal';

export const BN_GREGORIAN = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

/** Typical Bangladesh monthly rainfall (mm) used if seasonal API is unavailable. */
const BD_PRECIP_MM = [8, 20, 52, 110, 230, 390, 410, 330, 280, 155, 28, 10];
const BD_TEMP_C = [19, 22, 26, 29, 30, 29, 29, 29, 29, 27, 24, 20];

type CacheEntry<T> = { at: number; value: T };

/** Seasonal runs update monthly; one fetch per area per day is plenty. */
const SEASONAL_TTL_MS = 24 * 60 * 60_000;
/** Retry the real API soon when we had to fall back to normals. */
const CLIMATOLOGY_TTL_MS = 60 * 60_000;

type Outlook = { months: MonthOutlook[]; source: OutlookSource };

@Injectable()
export class OpenMeteoWeatherAdapter implements WeatherPort {
  private readonly logger = new Logger(OpenMeteoWeatherAdapter.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  async current(point: GeoPoint): Promise<CurrentWeather> {
    const key = `cur:${round(point.lat)}:${round(point.lon)}`;
    const hit = this.read<CurrentWeather>(key, 15 * 60_000);
    if (hit) return { ...hit, locationBn: point.locationBn };

    const url =
      `${FORECAST_URL}?latitude=${point.lat}&longitude=${point.lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,precipitation_probability` +
      `&timezone=Asia%2FDhaka`;
    try {
      const json = await getJson(url);
      const cur = json.current ?? {};
      const code = Number(cur.weather_code ?? 2);
      const kind = kindFromWmo(code);
      const value: CurrentWeather = {
        tempC: Math.round(Number(cur.temperature_2m ?? 30)),
        humidity: Math.round(Number(cur.relative_humidity_2m ?? 70)),
        windKph: Math.round(Number(cur.wind_speed_10m ?? 8)),
        weatherCode: code,
        kind,
        conditionBn: conditionBn(kind),
        conditionEn: conditionEn(kind),
        precipitationMm: Number(cur.precipitation ?? 0),
        precipProb: Math.round(Number(cur.precipitation_probability ?? 0)),
        locationBn: point.locationBn,
        source: 'Open-Meteo',
      };
      this.write(key, value);
      return value;
    } catch (err) {
      this.logger.warn(`Open-Meteo current failed: ${String(err)}`);
      throw Errors.weatherUnavailable();
    }
  }

  async sprayAdvisory(point: GeoPoint) {
    const now = await this.current(point);
    let level: SprayLevel = 'safe';
    let reasonBn = 'আজ আকাশ অনুকূল, সকালে বা বিকেলে স্প্রে করা যায়।';
    if (
      now.kind === 'storm' ||
      now.precipProb >= 70 ||
      now.precipitationMm >= 1
    ) {
      level = 'wait';
      reasonBn = 'বৃষ্টি বা বজ্রের সম্ভাবনা বেশি — আজ স্প্রে করবেন না।';
    } else if (now.kind === 'rainy' || now.precipProb >= 40) {
      level = 'caution';
      reasonBn =
        'হালকা বৃষ্টির সম্ভাবনা আছে, স্প্রে করলে সকালের শুকনো সময় বেছে নিন।';
    }
    return { level, reasonBn };
  }

  async summaryBn(point: GeoPoint) {
    try {
      const url =
        `${FORECAST_URL}?latitude=${point.lat}&longitude=${point.lon}` +
        `&daily=precipitation_sum,temperature_2m_max&forecast_days=16&timezone=Asia%2FDhaka`;
      const json = await getJson(url);
      const rains: number[] = json.daily?.precipitation_sum ?? [];
      const temps: number[] = json.daily?.temperature_2m_max ?? [];
      const total = rains.reduce((a, b) => a + Number(b || 0), 0);
      const avgTemp =
        temps.length > 0
          ? Math.round(
              temps.reduce((a, b) => a + Number(b || 0), 0) / temps.length,
            )
          : 30;
      if (total >= 80) {
        return `আগামী ১৬ দিনে প্রায় ${Math.round(total)} মিমি বৃষ্টির সম্ভাবনা, গড় তাপমাত্রা ${avgTemp}° — জমি ভেজা থাকবে।`;
      }
      if (total >= 25) {
        return `আগামী ১৬ দিনে মাঝারি বৃষ্টি (${Math.round(total)} মিমি), গড় তাপমাত্রা ${avgTemp}°।`;
      }
      return `আগামী ১৬ দিন তুলনামূলক শুষ্ক (${Math.round(total)} মিমি বৃষ্টি), গড় তাপমাত্রা ${avgTemp}°।`;
    } catch (err) {
      this.logger.warn(`Open-Meteo summary failed: ${String(err)}`);
      const now = await this.current(point);
      return `এখন ${now.conditionBn}, তাপমাত্রা ${now.tempC}°।`;
    }
  }

  async sixMonthPlan(point: GeoPoint) {
    const { months: all, source } = await this.monthlyOutlook(point);
    const months = all.slice(0, 6);
    const rainy = months
      .filter((m) => (m.precipMm ?? 0) >= 140)
      .map((m) => m.monthBn);
    const dry = months
      .filter((m) => (m.precipMm ?? 0) < 60)
      .map((m) => m.monthBn);
    const recommendationBn = [
      `${point.locationBn} এলাকার Open-Meteo মৌসুমি পূর্বাভাস (৬ মাস) অনুযায়ী চাষ সাজান।`,
      rainy.length
        ? `${rainy.join(', ')} মাসে বৃষ্টি বেশি থাকার সম্ভাবনা — আমন ধান বা ভেজা-সহনশীল ফসল উপযোগী।`
        : 'আগামী মাসগুলোতে বৃষ্টি স্বাভাবিকের কাছাকাছি থাকতে পারে।',
      dry.length
        ? `${dry.join(', ')} মাসে শুষ্ক আবহাওয়া — আলু, সরিষা বা সেচনির্ভর সবজি ভালো।`
        : 'শুষ্ক মাস কম; মাটির রস দেখে বীজতলা সাজান।',
      'এটি এলাকাভিত্তিক সম্ভাব্য পূর্বাভাস, দৈনিক আবহাওয়া বদলাতে পারে।',
    ].join(' ');

    return { recommendationBn, months, source };
  }

  /**
   * Memory → Mongo (`WeatherCache`, 24 h) → Open-Meteo seasonal API.
   * The Mongo layer survives serverless cold starts; climate normals are only
   * kept in memory so the next request retries the real forecast.
   */
  private async monthlyOutlook(point: GeoPoint): Promise<Outlook> {
    // Seasonal model cells are ~1°; 0.25° keeps neighbouring districts apart.
    const key = `seasonal:${quarter(point.lat)}:${quarter(point.lon)}`;
    const hit = this.read<Outlook>(key, SEASONAL_TTL_MS);
    if (hit) return hit;

    const stored = await this.readStored(key);
    if (stored) {
      this.write(key, stored);
      return stored;
    }

    const seasonal = await this.trySeasonal(point);
    if (seasonal) {
      const value: Outlook = { months: seasonal, source: 'seasonal' };
      this.write(key, value);
      await this.store(key, value);
      return value;
    }

    const value: Outlook = {
      months: this.climatologyMonths(),
      source: 'climatology',
    };
    this.cache.set(key, {
      at: Date.now() - (SEASONAL_TTL_MS - CLIMATOLOGY_TTL_MS),
      value,
    });
    return value;
  }

  private async readStored(key: string): Promise<Outlook | null> {
    try {
      const row = await this.prisma.weatherCache.findUnique({ where: { key } });
      if (!row || Date.now() - row.fetchedAt.getTime() > SEASONAL_TTL_MS)
        return null;
      const value = row.payload as unknown as Outlook;
      return Array.isArray(value?.months) && value.months.length ? value : null;
    } catch (err) {
      this.logger.warn(`Weather cache read failed: ${String(err)}`);
      return null;
    }
  }

  private async store(key: string, value: Outlook) {
    const payload = value as unknown as Prisma.InputJsonValue;
    try {
      await this.prisma.weatherCache.upsert({
        where: { key },
        update: { payload, fetchedAt: new Date() },
        create: { key, payload, fetchedAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`Weather cache write failed: ${String(err)}`);
    }
  }

  private async trySeasonal(point: GeoPoint): Promise<MonthOutlook[] | null> {
    const url =
      `${SEASONAL_URL}?latitude=${point.lat}&longitude=${point.lon}` +
      `&monthly=temperature_2m_mean,precipitation_mean&forecast_months=6&timezone=Asia%2FDhaka`;
    try {
      const json = await getJson(url);
      const times: string[] = json.monthly?.time ?? [];
      let precip: number[] = json.monthly?.precipitation_mean ?? [];
      const temps: number[] = json.monthly?.temperature_2m_mean ?? [];
      if (!times.length || !precip.length) return null;
      const maxP = Math.max(...precip.map((n) => Number(n || 0)));
      if (maxP > 0 && maxP < 40) {
        precip = precip.map((n) => Number(n || 0) * 30);
      }
      return times
        .slice(0, 6)
        .map((iso, i) => monthRow(iso, Number(temps[i]), Number(precip[i])));
    } catch (err) {
      this.logger.warn(
        `Open-Meteo seasonal failed, using climate normals: ${String(err)}`,
      );
      return null;
    }
  }

  private climatologyMonths(): MonthOutlook[] {
    const start = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const idx = d.getMonth();
      return monthRow(
        `${d.getFullYear()}-${String(idx + 1).padStart(2, '0')}`,
        BD_TEMP_C[idx],
        BD_PRECIP_MM[idx],
      );
    });
  }

  private read<T>(key: string, ttlMs: number): T | null {
    const row = this.cache.get(key);
    if (!row || Date.now() - row.at > ttlMs) return null;
    return row.value as T;
  }

  private write(key: string, value: unknown) {
    this.cache.set(key, { at: Date.now(), value });
  }
}

function monthRow(iso: string, tempC: number, precipMm: number): MonthOutlook {
  const monthIdx = Number(iso.slice(5, 7)) - 1;
  const kind = kindFromPrecipMm(precipMm);
  const t = Number.isFinite(tempC) ? Math.round(tempC) : 28;
  const p = Number.isFinite(precipMm) ? Math.round(precipMm) : 0;
  return {
    monthIso: iso.slice(0, 7),
    monthBn: BN_GREGORIAN[(monthIdx + 12) % 12] ?? iso,
    weatherIcon: iconFromKind(kind),
    recommendedCropBn: cropFor(monthIdx, p, t),
    tempC: t,
    precipMm: p,
  };
}

function cropFor(monthIdx: number, precipMm: number, tempC: number): string {
  if (precipMm >= 220 && tempC >= 26) return 'আমন ধান';
  if (precipMm >= 140) return 'শাকসবজি';
  if (precipMm < 50 && tempC <= 23) return monthIdx % 2 === 0 ? 'আলু' : 'সরিষা';
  if (precipMm < 70 && tempC > 23) return 'পেঁয়াজ';
  if (tempC <= 24) return 'মসুর ডাল';
  return 'সবজি';
}

function round(n: number) {
  return Math.round(n * 20) / 20;
}

function quarter(n: number) {
  return (Math.round(n * 4) / 4).toFixed(2);
}

async function getJson(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as {
      current?: Record<string, number>;
      daily?: { precipitation_sum?: number[]; temperature_2m_max?: number[] };
      monthly?: {
        time?: string[];
        precipitation_mean?: number[];
        temperature_2m_mean?: number[];
      };
    };
  } finally {
    clearTimeout(timer);
  }
}
