import type { SprayLevel } from '@prisma/client';
import type { GeoPoint } from './coords';
import type { WeatherKind } from './wmo';

export type CurrentWeather = {
  tempC: number;
  humidity: number;
  windKph: number;
  weatherCode: number;
  kind: WeatherKind;
  conditionBn: string;
  conditionEn: string;
  precipitationMm: number;
  precipProb: number;
  locationBn: string;
  source: string;
};

export type MonthOutlook = {
  monthBn: string;
  weatherIcon: string;
  recommendedCropBn: string;
  tempC?: number;
  precipMm?: number;
};

export interface WeatherPort {
  current(point: GeoPoint): Promise<CurrentWeather>;
  sprayAdvisory(point: GeoPoint): Promise<{ level: SprayLevel; reasonBn: string }>;
  summaryBn(point: GeoPoint): Promise<string>;
  sixMonthPlan(point: GeoPoint): Promise<{
    recommendationBn: string;
    months: MonthOutlook[];
  }>;
}
