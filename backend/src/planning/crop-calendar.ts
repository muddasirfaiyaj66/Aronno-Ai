import {
  COST_CROP_SLUGS,
  isCostCropSlug,
  type CostCropSlug,
} from '../cost/cultivation-costs';
import { BN_GREGORIAN } from '../weather/open-meteo.adapter';

/** Crops the plan may prioritise — same list the cost table can price. */
export const PLAN_CROPS: Record<
  CostCropSlug,
  { nameBn: string; minDays: number; maxDays: number }
> = {
  rice: { nameBn: 'ধান', minDays: 120, maxDays: 140 },
  potato: { nameBn: 'আলু', minDays: 90, maxDays: 100 },
  tomato: { nameBn: 'টমেটো', minDays: 100, maxDays: 120 },
  vegetable: { nameBn: 'শাকসবজি', minDays: 60, maxDays: 90 },
  onion: { nameBn: 'পেঁয়াজ', minDays: 110, maxDays: 130 },
  mustard: { nameBn: 'সরিষা', minDays: 85, maxDays: 100 },
  lentil: { nameBn: 'মসুর ডাল', minDays: 100, maxDays: 110 },
  corn: { nameBn: 'ভুট্টা', minDays: 120, maxDays: 140 },
};

export const PLAN_CROP_SLUGS = COST_CROP_SLUGS;

/** Maps the weather adapter's rule-based crop names to plan slugs. */
export function slugForCropBn(cropBn: string): CostCropSlug {
  if (/ধান/.test(cropBn)) return 'rice';
  if (/আলু/.test(cropBn)) return 'potato';
  if (/টমেটো/.test(cropBn)) return 'tomato';
  if (/পেঁয়াজ/.test(cropBn)) return 'onion';
  if (/সরিষা/.test(cropBn)) return 'mustard';
  if (/ডাল|মসুর/.test(cropBn)) return 'lentil';
  if (/ভুট্টা/.test(cropBn)) return 'corn';
  return 'vegetable';
}

export function asPlanSlug(raw: unknown): CostCropSlug | null {
  return typeof raw === 'string' && isCostCropSlug(raw) ? raw : null;
}

/** নভেম্বর → "নভেম্বর মাসের" (safe for every month name) */
export function monthOfBn(month: string) {
  return `${month} মাসের`;
}

/** নভেম্বর → "নভেম্বর মাসে" */
export function inMonthBn(month: string) {
  return `${month} মাসে`;
}

function monthName(monthIdx: number) {
  return BN_GREGORIAN[((monthIdx % 12) + 12) % 12];
}

/**
 * Rule-based windows used when Gemini is unavailable: sow in the first half
 * of the month, harvest after the crop's typical duration.
 */
export function defaultWindows(slug: CostCropSlug, monthIso: string) {
  const crop = PLAN_CROPS[slug];
  const monthIdx = Number(monthIso.slice(5, 7)) - 1;
  const from = monthIdx + Math.round(crop.minDays / 30);
  const to = monthIdx + Math.round(crop.maxDays / 30);
  return {
    plantingWindowBn: `${monthOfBn(monthName(monthIdx))} ১ম–২য় সপ্তাহ`,
    harvestWindowBn:
      from === to ? monthName(from) : `${monthName(from)}–${monthName(to)}`,
  };
}

export function durationsForPrompt() {
  return PLAN_CROP_SLUGS.map(
    (slug) =>
      `${slug}=${PLAN_CROPS[slug].nameBn} (${PLAN_CROPS[slug].minDays}–${PLAN_CROPS[slug].maxDays} days)`,
  ).join(', ');
}
