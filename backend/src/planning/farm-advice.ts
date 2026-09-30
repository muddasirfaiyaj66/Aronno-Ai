import { z } from 'zod';
import type { MonthOutlook, OutlookSource } from '../weather/weather.types';
import { BN_GREGORIAN } from '../weather/open-meteo.adapter';
import {
  cultivationCost,
  toBigha,
  type CostCropSlug,
  type CultivationCost,
} from '../cost/cultivation-costs';
import {
  PLAN_CROPS,
  PLAN_CROP_SLUGS,
  asPlanSlug,
  defaultWindows,
  durationsForPrompt,
  inMonthBn,
  slugForCropBn,
} from './crop-calendar';

const name = z.string().trim().min(1).max(40);

export const adviseSchema = z
  .object({
    landSize: z.number().positive().max(10_000),
    landUnit: z.enum(['bigha', 'acre']),
    landType: z.enum(['high', 'medium', 'low']).optional(),
    pastCrops: z
      .array(
        z
          .object({
            nameBn: name,
            season: z.enum(['rabi', 'kharif1', 'kharif2']).optional(),
          })
          .strict(),
      )
      .max(12),
    wantedCrops: z.array(name).max(8),
    goal: z.enum(['profit', 'low_cost', 'food', 'low_risk']).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  })
  .strict();

export type AdviseInput = z.infer<typeof adviseSchema>;

/** Models sometimes answer "suitable", "not now", "ভালো"… — map to our 3 values. */
function toVerdict(v: unknown) {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  if (/not|later|না|নয়|পরে/.test(s)) return 'not_now';
  if (/good|suit|yes|best|ভালো|উপযোগী/.test(s)) return 'good';
  return 'risky';
}

const line = z.string().trim().min(2).max(220);

const aiAdviceSchema = z.object({
  summaryBn: z.string().trim().min(30).max(900),
  topCrops: z
    .array(
      z.object({
        nameBn: z.string().trim().min(2).max(40),
        cropSlug: z.string().optional().nullable(),
        score: z.number().min(0).max(100),
        fitBn: line,
        rotationBn: line,
        riskBn: line,
        sowBn: z.string().trim().min(2).max(80),
        harvestBn: z.string().trim().min(2).max(80),
        wanted: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(5),
  wantedCheck: z
    .array(
      z.object({
        nameBn: z.string().trim().min(1).max(40),
        verdict: z.preprocess(toVerdict, z.enum(['good', 'risky', 'not_now'])),
        reasonBn: line,
      }),
    )
    .max(8)
    .default([]),
  timeline: z
    .array(
      z.object({ monthBn: z.string().trim().min(2).max(20), activityBn: line }),
    )
    .max(8)
    .default([]),
});

export type TopCrop = {
  nameBn: string;
  cropSlug?: CostCropSlug;
  score: number;
  fitBn: string;
  rotationBn: string;
  riskBn: string;
  sowBn: string;
  harvestBn: string;
  wanted: boolean;
  cost?: CultivationCost;
};

export type FarmAdvice = {
  summaryBn: string;
  topCrops: TopCrop[];
  wantedCheck: {
    nameBn: string;
    verdict: 'good' | 'risky' | 'not_now';
    reasonBn: string;
  }[];
  timeline: { monthBn: string; activityBn: string }[];
  months: {
    month: string;
    weatherIcon: string;
    recommendedCropBn: string;
    tempC?: number;
    precipMm?: number;
  }[];
  locationBn: string;
  outlookSource: OutlookSource;
  generatedBy: 'ai' | 'rules';
};

type Outlook = { months: MonthOutlook[]; source: OutlookSource };

const LAND_BN = {
  high: 'উঁচু জমি',
  medium: 'মাঝারি উঁচু জমি',
  low: 'নিচু জমি',
};
const SEASON_BN = { rabi: 'রবি', kharif1: 'খরিফ-১', kharif2: 'খরিফ-২' };
const GOAL_BN = {
  profit: 'বেশি লাভ',
  low_cost: 'কম খরচ',
  food: 'পরিবারের খাবার',
  low_risk: 'কম ঝুঁকি',
};

/** Typical sowing / transplanting months in Bangladesh (0 = January). */
const SOW_MONTHS: Record<CostCropSlug, number[]> = {
  rice: [0, 5, 6, 7, 11], // বোরো Dec–Jan, আমন Jun–Aug
  potato: [10, 11],
  tomato: [9, 10],
  vegetable: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  onion: [10, 11],
  mustard: [9, 10],
  lentil: [9, 10],
  corn: [1, 2, 10, 11],
};

/** Plant families, so rotation can avoid the same family back to back. */
function familyOf(nameBn: string): string {
  if (/ধান|গম|ভুট্টা|আখ|যব|কাউন/.test(nameBn)) return 'cereal';
  if (/আলু|টমেটো|বেগুন|মরিচ/.test(nameBn)) return 'solanum';
  if (/সরিষা|কপি|মুলা|শালগম/.test(nameBn)) return 'brassica';
  if (/ডাল|মসুর|মুগ|ছোলা|মটর|খেসারি|মাষকলাই|সয়াবিন|চিনাবাদাম/.test(nameBn))
    return 'legume';
  if (/পেঁয়াজ|রসুন/.test(nameBn)) return 'allium';
  if (/পাট/.test(nameBn)) return 'jute';
  if (/তরমুজ|লাউ|কুমড়া|শসা|করলা|ঝিঙা/.test(nameBn)) return 'cucurbit';
  return 'other';
}

const monthName = (i: number) => BN_GREGORIAN[((i % 12) + 12) % 12];
const bn = (n: number | undefined) =>
  n === undefined ? '—' : new Intl.NumberFormat('bn-BD').format(n);

export function buildAdvicePrompt(
  input: AdviseInput,
  locationBn: string,
  outlook: Outlook,
) {
  const monthLines = outlook.months
    .map(
      (m, i) =>
        `${i + 1}. ${m.monthBn} (${m.monthIso}): mean temp ${m.tempC ?? '?'}°C, rain ${m.precipMm ?? '?'} mm`,
    )
    .join('\n');
  const past = input.pastCrops.length
    ? input.pastCrops
        .map((c) =>
          c.season ? `${c.nameBn} (${SEASON_BN[c.season]})` : c.nameBn,
        )
        .join(', ')
    : 'not given';
  const wanted = input.wantedCrops.length
    ? input.wantedCrops.join(', ')
    : 'no preference';
  const sourceNote =
    outlook.source === 'seasonal'
      ? 'Open-Meteo seasonal forecast (monthly means)'
      : 'Bangladesh long-term monthly climate normals (forecast unavailable)';

  return `You are an experienced Bangladeshi agronomist (DAE/BARI practice). Advise ONE specific smallholder farmer in ${locationBn}, Bangladesh, which crops are best for the NEXT 6 MONTHS on their land.

Farmer:
- Land: ${input.landSize} ${input.landUnit === 'acre' ? 'acre' : 'bigha'}${input.landType ? `, ${LAND_BN[input.landType]}` : ''}
- Grown in the last 12 months: ${past}
- Wants to grow: ${wanted}
- Goal: ${input.goal ? GOAL_BN[input.goal] : 'not given'}

Weather outlook for the area (${sourceNote}):
${monthLines}

Growing durations for crops we can price (slug=Bangla name, days): ${durationsForPrompt()}

Rules:
- Only recommend crops whose sowing window in Bangladesh falls inside these 6 months, and that can grow in the forecast rain and temperature.
- Crop rotation: do not put the crop (or the same plant family) they just grew first; prefer a legume or a different family after heavy feeders like rice or potato.
- Put the farmer's wanted crops first only when weather and season suit them; otherwise explain honestly.
- Consider land type: low land floods in heavy rain, high land needs irrigation in dry months.
- Every fitBn must cite a month and its rain or temperature figure. No generic advice, no prices or yields you are not given.

Return 3 or 4 topCrops, best first, score 0–100. cropSlug is one slug from the list above if it matches, else null. wantedCheck: one item for EACH wanted crop; verdict is exactly one of "good", "risky", "not_now". timeline: one short activity for each of the 6 months, in order.
All text in simple Bangla a farmer understands, each field one short sentence.

JSON only:
{"summaryBn":"...","topCrops":[{"nameBn":"সরিষা","cropSlug":"mustard","score":88,"fitBn":"...","rotationBn":"...","riskBn":"...","sowBn":"অক্টোবরের শেষ সপ্তাহ","harvestBn":"জানুয়ারির মাঝামাঝি","wanted":false}],"wantedCheck":[{"nameBn":"...","verdict":"good","reasonBn":"..."}],"timeline":[{"monthBn":"অক্টোবর","activityBn":"..."}]}`;
}

export function parseAiAdvice(raw: unknown, input: AdviseInput) {
  const parsed = aiAdviceSchema.parse(raw);
  const wantedNames = input.wantedCrops.map((w) => w.trim());
  const pastFamilies = new Set(
    input.pastCrops.map((c) => familyOf(c.nameBn)).filter((f) => f !== 'other'),
  );
  return {
    summaryBn: parsed.summaryBn,
    topCrops: parsed.topCrops
      .slice(0, 4)
      // Rotation guard: the model sometimes still ranks last year's crop high.
      .map((c) => ({
        ...c,
        score: pastFamilies.has(familyOf(c.nameBn))
          ? Math.max(5, c.score - 15)
          : c.score,
      }))
      .sort((a, b) => b.score - a.score)
      .map<TopCrop>((c) => {
        const slug =
          asPlanSlug(c.cropSlug) ??
          (isPlanCropName(c.nameBn) ? slugForCropBn(c.nameBn) : null);
        return {
          nameBn: c.nameBn,
          cropSlug: slug ?? undefined,
          score: Math.round(c.score),
          fitBn: c.fitBn,
          rotationBn: c.rotationBn,
          riskBn: c.riskBn,
          sowBn: c.sowBn,
          harvestBn: c.harvestBn,
          wanted:
            c.wanted ??
            wantedNames.some(
              (w) => w.includes(c.nameBn) || c.nameBn.includes(w),
            ),
        };
      }),
    wantedCheck: parsed.wantedCheck,
    timeline: parsed.timeline,
  };
}

/** True when the name is one of the crops the cost table can price. */
function isPlanCropName(nameBn: string) {
  return /ধান|আলু|টমেটো|পেঁয়াজ|সরিষা|মসুর|ভুট্টা|সবজি/.test(nameBn);
}

/**
 * Rule-based advice when Gemini is unavailable: score each priceable crop by
 * sowing season, the weather rule's monthly picks, rotation and the farmer's
 * wishes. Text only states what these rules found.
 */
export function ruleAdvice(input: AdviseInput, outlook: Outlook) {
  const months = outlook.months;
  const startIdx = months.length
    ? Number(months[0].monthIso.slice(5, 7)) - 1
    : new Date().getMonth();
  const pastFamilies = new Set(input.pastCrops.map((c) => familyOf(c.nameBn)));
  const wantedSlugs = new Set(
    input.wantedCrops.filter(isPlanCropName).map((w) => slugForCropBn(w)),
  );
  const ruleSlugs = months.map((m) => slugForCropBn(m.recommendedCropBn));

  const scored = PLAN_CROP_SLUGS.map((slug) => {
    const crop = PLAN_CROPS[slug];
    // First month (0–2 from now) this crop can be sown.
    const offset = [0, 1, 2].find((o) =>
      SOW_MONTHS[slug].includes((startIdx + o) % 12),
    );
    const weatherHits = ruleSlugs.filter((s) => s === slug).length;
    const sameFamily = pastFamilies.has(familyOf(crop.nameBn));
    let score = offset === undefined ? 20 : 60 - offset * 5;
    score += Math.min(weatherHits, 3) * 8;
    if (sameFamily) score -= 20;
    if (wantedSlugs.has(slug)) score += 12;
    if (
      input.landType === 'low' &&
      slug !== 'rice' &&
      months.some((m) => (m.precipMm ?? 0) >= 220)
    )
      score -= 10;
    return {
      slug,
      offset,
      weatherHits,
      sameFamily,
      score: Math.max(5, Math.min(95, score)),
    };
  }).sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.offset !== undefined).slice(0, 3);
  const topCrops = top.map<TopCrop>((s) => {
    const crop = PLAN_CROPS[s.slug];
    const sowIdx = startIdx + (s.offset ?? 0);
    const sowMonth = months[s.offset ?? 0];
    const windows = defaultWindows(
      s.slug,
      sowMonth?.monthIso ??
        `2000-${String((sowIdx % 12) + 1).padStart(2, '0')}`,
    );
    return {
      nameBn: crop.nameBn,
      cropSlug: s.slug,
      score: s.score,
      fitBn: sowMonth
        ? `${inMonthBn(sowMonth.monthBn)} বৃষ্টি ${bn(sowMonth.precipMm)} মিমি, গড় তাপমাত্রা ${bn(sowMonth.tempC)}° — ${crop.nameBn} বোনার সময়।`
        : `${inMonthBn(monthName(sowIdx))} ${crop.nameBn} বোনার সময়।`,
      rotationBn: s.sameFamily
        ? `গত বছর একই ধরনের ফসল করেছেন, তাই জমিতে বেশি জৈব সার দিন।`
        : input.pastCrops.length
          ? `গত বছরের ফসল থেকে ভিন্ন ধরনের, তাই মাটির জন্য ভালো পালাক্রম।`
          : `আগের ফসলের তথ্য নেই, মাটি পরীক্ষা করে সার দিন।`,
      riskBn: riskFor(months.slice(s.offset ?? 0)),
      sowBn: windows.plantingWindowBn,
      harvestBn: windows.harvestWindowBn,
      wanted: wantedSlugs.has(s.slug),
    };
  });

  const wantedCheck = input.wantedCrops.map((w) => {
    if (!isPlanCropName(w)) {
      return {
        nameBn: w,
        verdict: 'risky' as const,
        reasonBn:
          'এই ফসলের জন্য আমাদের নিয়মে হিসাব নেই — স্থানীয় কৃষি অফিসে জিজ্ঞেস করুন।',
      };
    }
    const s = scored.find((x) => x.slug === slugForCropBn(w))!;
    if (s.offset === undefined) {
      return {
        nameBn: w,
        verdict: 'not_now' as const,
        reasonBn: 'আগামী ৩ মাসে এর বোনার মৌসুম নয়।',
      };
    }
    return s.sameFamily
      ? {
          nameBn: w,
          verdict: 'risky' as const,
          reasonBn: 'মৌসুম ঠিক আছে, তবে গত বছর একই ধরনের ফসল করেছেন।',
        }
      : {
          nameBn: w,
          verdict: 'good' as const,
          reasonBn: `${inMonthBn(monthName(startIdx + s.offset))} বোনা যাবে।`,
        };
  });

  const timeline = months.map((m, i) => {
    const sow = topCrops
      .filter((c) => c.sowBn.startsWith(m.monthBn))
      .map((c) => c.nameBn);
    const harvest = topCrops
      .filter((c) => c.harvestBn.includes(m.monthBn))
      .map((c) => c.nameBn);
    const rain = m.precipMm ?? 0;
    const care =
      rain >= 200
        ? 'নালা পরিষ্কার রাখুন'
        : rain < 40
          ? 'নিয়মিত সেচ দিন'
          : 'আগাছা পরিষ্কার ও সার দিন';
    const parts = [
      sow.length ? `${sow.join(', ')} বপন` : '',
      harvest.length ? `${harvest.join(', ')} কাটা` : '',
      i === 0 && !sow.length ? 'জমি তৈরি ও মাটি পরীক্ষা' : '',
      care,
    ].filter(Boolean);
    return { monthBn: m.monthBn, activityBn: `${parts.join('; ')}।` };
  });

  const best = topCrops[0];
  const summaryBn = best
    ? `আপনার ${bn(input.landSize)} ${input.landUnit === 'acre' ? 'একর' : 'বিঘা'} জমির জন্য আগামী ৬ মাসে ${topCrops.map((c) => c.nameBn).join(', ')} ভালো। সবচেয়ে উপযোগী ${best.nameBn} — ${best.sowBn} বপন, ${best.harvestBn} নাগাদ কাটা। ${riskFor(months)}`
    : 'আগামী ৬ মাসের জন্য উপযুক্ত ফসল খুঁজে পাওয়া যায়নি।';

  return { summaryBn, topCrops, wantedCheck, timeline };
}

function riskFor(months: MonthOutlook[]) {
  const wet = months.find((m) => (m.precipMm ?? 0) >= 220);
  const dry = months.find((m) => (m.precipMm ?? 0) < 30);
  if (wet)
    return `${inMonthBn(wet.monthBn)} ভারী বৃষ্টি (${bn(wet.precipMm)} মিমি) — পানি নিষ্কাশনের ব্যবস্থা রাখুন।`;
  if (dry)
    return `${inMonthBn(dry.monthBn)} বৃষ্টি কম (${bn(dry.precipMm)} মিমি) — সেচের ব্যবস্থা রাখুন।`;
  return 'বড় আবহাওয়া ঝুঁকি দেখা যাচ্ছে না, তবে নিয়মিত জমি দেখুন।';
}

/** Tops up a short AI list with rule-based crops it didn't mention. */
export function fillTopCrops(ai: TopCrop[], rules: TopCrop[], min = 3) {
  const out = [...ai];
  for (const r of rules) {
    if (out.length >= min) break;
    const dup = out.some(
      (c) =>
        (c.cropSlug && c.cropSlug === r.cropSlug) ||
        c.nameBn.includes(r.nameBn) ||
        r.nameBn.includes(c.nameBn),
    );
    if (!dup) out.push(r);
  }
  return out;
}

/** Attaches the cultivation cost for the farmer's land to priceable crops. */
export function withCosts(crops: TopCrop[], input: AdviseInput): TopCrop[] {
  const bigha = toBigha(input.landSize, input.landUnit);
  return crops.map((c) =>
    c.cropSlug ? { ...c, cost: cultivationCost(c.cropSlug, bigha) } : c,
  );
}
