import { Injectable } from '@nestjs/common';
import type { Severity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BANGLADESH_DISTRICTS } from '../lookups/bangladesh-districts';

export const HEATMAP_DEFAULT_DAYS = 60;
const MIN_DAYS = 7;
const MAX_DAYS = 365;
const MAX_ROWS = 20_000;

const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Weighted-score thresholds for an area (sum of severity weights). */
const LEVEL_MEDIUM = 4;
const LEVEL_HIGH = 10;

const HEALTHY = /healthy|no disease|সুস্থ|রোগ নেই/i;

export type HeatLevel = 'low' | 'medium' | 'high';

export type HeatmapLocation = {
  slug: string;
  nameBn: string;
  lat: number;
  lon: number;
};

export type HeatmapEntry = {
  location: HeatmapLocation;
  diseaseType: { nameBn: string; nameEn: string };
  caseCount: number;
  /** Sum of severity weights (low 1, medium 2, high 3). */
  severityScore: number;
};

export type HeatmapArea = {
  location: HeatmapLocation;
  caseCount: number;
  severityScore: number;
  level: HeatLevel;
  diseases: Omit<HeatmapEntry, 'location'>[];
};

export type HeatmapResponse = {
  windowDays: number;
  since: string;
  generatedAt: string;
  entries: HeatmapEntry[];
  areas: HeatmapArea[];
};

export function levelFor(score: number): HeatLevel {
  if (score >= LEVEL_HIGH) return 'high';
  if (score >= LEVEL_MEDIUM) return 'medium';
  return 'low';
}

export function clampWindowDays(raw?: string | number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return HEATMAP_DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)));
}

const COORDS_BY_SLUG = new Map(BANGLADESH_DISTRICTS.map((d) => [d.slug, d]));

@Injectable()
export class HeatmapService {
  constructor(private readonly prisma: PrismaService) {}

  /** Disease diagnoses grouped by district × disease over a recent window. */
  async aggregate(windowDays = HEATMAP_DEFAULT_DAYS): Promise<HeatmapResponse> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.diagnosis.findMany({
      where: { createdAt: { gte: since } },
      select: {
        districtId: true,
        diseaseNameBn: true,
        diseaseNameEn: true,
        severity: true,
      },
      take: MAX_ROWS,
    });

    const districtIds = [
      ...new Set(
        rows.map((r) => r.districtId).filter((id): id is string => !!id),
      ),
    ];
    const districts = districtIds.length
      ? await this.prisma.district.findMany({
          where: { id: { in: districtIds } },
        })
      : [];
    const locationById = new Map<string, HeatmapLocation>();
    for (const d of districts) {
      const coords = COORDS_BY_SLUG.get(d.slug);
      if (!coords) continue;
      locationById.set(d.id, {
        slug: d.slug,
        nameBn: d.nameBn,
        lat: coords.lat,
        lon: coords.lon,
      });
    }

    const grouped = new Map<string, HeatmapEntry>();
    for (const row of rows) {
      if (!row.districtId) continue;
      const location = locationById.get(row.districtId);
      if (!location) continue;
      if (HEALTHY.test(row.diseaseNameEn) || HEALTHY.test(row.diseaseNameBn))
        continue;
      const key = `${location.slug}|${row.diseaseNameEn.trim().toLowerCase()}`;
      const entry = grouped.get(key) ?? {
        location,
        diseaseType: { nameBn: row.diseaseNameBn, nameEn: row.diseaseNameEn },
        caseCount: 0,
        severityScore: 0,
      };
      entry.caseCount += 1;
      entry.severityScore += SEVERITY_WEIGHT[row.severity];
      grouped.set(key, entry);
    }

    const entries = [...grouped.values()].sort(
      (a, b) => b.severityScore - a.severityScore,
    );

    const areaMap = new Map<string, HeatmapArea>();
    for (const e of entries) {
      const area = areaMap.get(e.location.slug) ?? {
        location: e.location,
        caseCount: 0,
        severityScore: 0,
        level: 'low' as HeatLevel,
        diseases: [],
      };
      area.caseCount += e.caseCount;
      area.severityScore += e.severityScore;
      area.diseases.push({
        diseaseType: e.diseaseType,
        caseCount: e.caseCount,
        severityScore: e.severityScore,
      });
      areaMap.set(e.location.slug, area);
    }
    const areas = [...areaMap.values()]
      .map((a) => ({ ...a, level: levelFor(a.severityScore) }))
      .sort((a, b) => b.severityScore - a.severityScore);

    return {
      windowDays,
      since: since.toISOString(),
      generatedAt: new Date().toISOString(),
      entries,
      areas,
    };
  }
}
