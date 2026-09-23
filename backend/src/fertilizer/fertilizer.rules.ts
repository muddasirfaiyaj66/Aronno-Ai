import { Injectable } from '@nestjs/common';
import type {
  AiFertilizerPort,
  FertilizerInput,
  FertilizerResult,
} from '../ai/ports';
import { asciiDigitsToBn } from '../common/bn-digits';

/**
 * Deterministic top-dressing rules, loosely following the BARC Fertilizer
 * Recommendation Guide (per bigha = 33 decimal). Sits behind AiFertilizerPort
 * so a Gemini / agronomist-backed engine can replace it without API changes.
 */

type Stage = 'seedling' | 'vegetative' | 'flowering' | 'maturity';
type Dose = { urea: number; mop: number };

type CropRule = {
  nameBn: string;
  stageBn: Record<Stage, string>;
  /** Top-dress per bigha for each stage. */
  dose: Record<Stage, Dose>;
  /** Earliest crop age (days) for the first top-dress. */
  firstTopDressDay: number;
  /** Legumes fix their own nitrogen. */
  legume?: boolean;
  lateNitrogenHarmBn?: string;
};

const STAGE_BN_DEFAULT: Record<Stage, string> = {
  seedling: 'চারা',
  vegetative: 'বৃদ্ধি',
  flowering: 'ফুল',
  maturity: 'পরিপক্ব',
};

const RULES: Record<string, CropRule> = {
  rice: {
    nameBn: 'ধান',
    stageBn: {
      seedling: 'চারা',
      vegetative: 'কুশি',
      flowering: 'থোড়/ফুল',
      maturity: 'পাকা',
    },
    dose: {
      seedling: { urea: 8, mop: 0 },
      vegetative: { urea: 8, mop: 3 },
      flowering: { urea: 5, mop: 3 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 15,
  },
  potato: {
    nameBn: 'আলু',
    stageBn: {
      seedling: 'গজানো',
      vegetative: 'মাটি তোলা',
      flowering: 'আলু বাড়ার',
      maturity: 'পাকা',
    },
    dose: {
      seedling: { urea: 0, mop: 0 },
      vegetative: { urea: 17, mop: 15 },
      flowering: { urea: 0, mop: 5 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 30,
    lateNitrogenHarmBn: 'দেরিতে ইউরিয়া দিলে আলু ছোট হয় ও দেরিতে পাকে।',
  },
  tomato: {
    nameBn: 'টমেটো',
    stageBn: STAGE_BN_DEFAULT,
    dose: {
      seedling: { urea: 7, mop: 4 },
      vegetative: { urea: 10, mop: 6 },
      flowering: { urea: 8, mop: 8 },
      maturity: { urea: 0, mop: 4 },
    },
    firstTopDressDay: 12,
  },
  vegetable: {
    nameBn: 'সবজি',
    stageBn: STAGE_BN_DEFAULT,
    dose: {
      seedling: { urea: 5, mop: 0 },
      vegetative: { urea: 8, mop: 5 },
      flowering: { urea: 5, mop: 5 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 10,
  },
  onion: {
    nameBn: 'পেঁয়াজ',
    stageBn: {
      seedling: 'চারা',
      vegetative: 'পাতা বাড়ার',
      flowering: 'কন্দ বাড়ার',
      maturity: 'পাকা',
    },
    dose: {
      seedling: { urea: 0, mop: 0 },
      vegetative: { urea: 10, mop: 5 },
      flowering: { urea: 0, mop: 5 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 25,
    lateNitrogenHarmBn:
      'কন্দ বাড়ার সময় ইউরিয়া দিলে গলা মোটা হয়, পেঁয়াজ পচে।',
  },
  mustard: {
    nameBn: 'সরিষা',
    stageBn: STAGE_BN_DEFAULT,
    dose: {
      seedling: { urea: 0, mop: 0 },
      vegetative: { urea: 6, mop: 0 },
      flowering: { urea: 0, mop: 0 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 20,
  },
  lentil: {
    nameBn: 'মসুর ডাল',
    stageBn: STAGE_BN_DEFAULT,
    dose: {
      seedling: { urea: 0, mop: 0 },
      vegetative: { urea: 0, mop: 0 },
      flowering: { urea: 0, mop: 0 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 0,
    legume: true,
  },
  corn: {
    nameBn: 'ভুট্টা',
    stageBn: {
      seedling: 'চারা',
      vegetative: 'হাঁটু-সমান',
      flowering: 'মোচা/ফুল',
      maturity: 'পাকা',
    },
    dose: {
      seedling: { urea: 15, mop: 0 },
      vegetative: { urea: 15, mop: 8 },
      flowering: { urea: 8, mop: 0 },
      maturity: { urea: 0, mop: 0 },
    },
    firstTopDressDay: 25,
  },
};

const bnKg = (kg: number) =>
  `${asciiDigitsToBn(Number.isInteger(kg) ? kg : kg.toFixed(1))} কেজি`;
const bnNum = (n: number) =>
  asciiDigitsToBn(Number.isInteger(n) ? n : Number(n.toFixed(1)));
const halfKg = (kg: number) => Math.round(kg * 2) / 2;

function doseLine(dose: Dose, factor = 1) {
  const parts: string[] = [];
  if (dose.urea > 0) parts.push(`ইউরিয়া ${bnKg(halfKg(dose.urea * factor))}`);
  if (dose.mop > 0)
    parts.push(`এমওপি (পটাশ) ${bnKg(halfKg(dose.mop * factor))}`);
  return parts.join(', ');
}

export function recommendFertilizer(input: FertilizerInput): FertilizerResult {
  const rule = RULES[input.cropSlug] ?? RULES.vegetable;
  const stage: Stage = input.growthStage;
  const stageBn = rule.stageBn[stage] ?? STAGE_BN_DEFAULT[stage];
  const reasons: string[] = [
    `${rule.nameBn}, বয়স ${bnNum(input.cropAgeDays)} দিন — ${stageBn} পর্যায়।`,
  ];
  let warning: string | undefined;

  let { urea, mop } = rule.dose[stage] ?? { urea: 0, mop: 0 };

  // Disease: less nitrogen (lush leaves feed blast/blight), a little more potash.
  if (input.hasDisease === 'yes') {
    const heavy = input.diseaseSeverity === 'high';
    urea *= heavy ? 0.5 : 0.6;
    mop *= 1.3;
    const which = input.diseaseNameBn
      ? `${input.diseaseNameBn} থাকায়`
      : 'রোগ থাকায়';
    reasons.push(
      `${which} ইউরিয়া ${heavy ? '৫০' : '৪০'}% কমানো হয়েছে, পটাশ কিছুটা বাড়ানো হয়েছে — রোগ প্রতিরোধে সাহায্য করে।`,
    );
    warning = heavy
      ? 'রোগ বেশি — আগে চিকিৎসা (স্প্রে) করুন, ৭ দিন পর সার দিন। বেশি ইউরিয়া দিলে রোগ বাড়বে।'
      : 'রোগ থাকা অবস্থায় বাড়তি ইউরিয়া দেবেন না, এতে রোগ ছড়ায়।';
  } else if (input.hasDisease === 'unsure') {
    urea *= 0.85;
    reasons.push('রোগ আছে কিনা নিশ্চিত নয়, তাই ইউরিয়া একটু কম ধরা হয়েছে।');
    warning = 'পাতায় দাগ বা হলুদ ভাব থাকলে আগে পাতার ছবি স্ক্যান করুন।';
  } else {
    reasons.push('ফসল সুস্থ — স্বাভাবিক মাত্রা।');
  }

  // Soil colour ≈ organic matter.
  if (input.soilColor === 'light') {
    urea *= 1.15;
    mop *= 1.15;
    reasons.push('হালকা রঙের মাটিতে জৈব পদার্থ কম, তাই মাত্রা ১৫% বেশি।');
  } else if (input.soilColor === 'dark') {
    urea *= 0.85;
    reasons.push('গাঢ় মাটিতে জৈব পদার্থ বেশি, তাই ইউরিয়া ১৫% কম।');
  }

  const tooEarly = input.cropAgeDays < rule.firstTopDressDay;
  const daysToWait = rule.firstTopDressDay - input.cropAgeDays;

  let timingBn: string;
  if (rule.legume) {
    urea = 0;
    mop = 0;
    reasons.push(
      'ডাল ফসল নিজেই বাতাস থেকে নাইট্রোজেন নেয় — উপরি ইউরিয়া লাগে না।',
    );
    timingBn = 'শেষ চাষের সময় দেওয়া সারই যথেষ্ট।';
  } else if (stage === 'maturity') {
    urea = 0;
    mop = 0;
    timingBn = 'ফসল পেকে এসেছে — আর সার দেবেন না, কাটার প্রস্তুতি নিন।';
  } else if (tooEarly) {
    timingBn = `আরও ${bnNum(daysToWait)} দিন পর (বয়স ${bnNum(rule.firstTopDressDay)} দিন হলে) প্রথম উপরি সার দিন।`;
    reasons.push('এখনও প্রথম উপরি সারের সময় হয়নি।');
  } else {
    timingBn = 'আগামী ২–৩ দিনের মধ্যে, সকালে বা বিকেলে দিন।';
  }

  if (urea === 0 && stage === 'flowering' && rule.lateNitrogenHarmBn) {
    reasons.push(rule.lateNitrogenHarmBn);
  }

  const perBigha = { urea, mop };
  const nothing = urea < 0.5 && mop < 0.5;

  const fertilizerNameBn = nothing
    ? 'এখন বাড়তি সার লাগবে না'
    : [urea >= 0.5 ? 'ইউরিয়া' : null, mop >= 0.5 ? 'এমওপি (পটাশ)' : null]
        .filter(Boolean)
        .join(' + ');

  const land = input.landSizeBigha;
  const dosagePerBigha = nothing
    ? 'উপরি সার দরকার নেই।'
    : `প্রতি বিঘায়: ${doseLine(perBigha)}। আপনার ${bnNum(land)} বিঘায় মোট: ${doseLine(perBigha, land)}।`;

  let applicationMethodBn: string;
  if (nothing) {
    applicationMethodBn = 'মাটির রস ঠিক রাখুন ও আগাছা পরিষ্কার রাখুন।';
  } else if (input.soilMoisture === 'wet') {
    applicationMethodBn =
      input.cropSlug === 'rice'
        ? 'জমিতে ২–৩ সেমি পানি রেখে ছিটিয়ে দিন, তারপর নিড়ানি দিয়ে মাটিতে মিশিয়ে দিন। বেশি পানি থাকলে আগে কিছুটা বের করে দিন।'
        : 'মাটি খুব ভেজা — জো আসা পর্যন্ত অপেক্ষা করুন, তারপর গাছের গোড়া থেকে একটু দূরে দিয়ে মাটিতে মিশিয়ে দিন।';
  } else if (input.soilMoisture === 'dry') {
    applicationMethodBn =
      'মাটি শুকনো — আগে হালকা সেচ দিন, মাটি ভেজা থাকতে সার দিয়ে মাটিতে মিশিয়ে দিন।';
  } else {
    applicationMethodBn =
      'গাছের সারির মাঝে ছিটিয়ে দিয়ে নিড়ানি দিয়ে মাটিতে মিশিয়ে দিন। পাতায় যেন না লাগে।';
  }
  if (input.soilColor === 'light' && !nothing) {
    applicationMethodBn += ' সম্ভব হলে বিঘাপ্রতি ২০০ কেজি গোবর/কম্পোস্ট দিন।';
  }

  return {
    fertilizerNameBn,
    dosagePerBigha,
    applicationMethodBn,
    timingBn,
    warningBn: warning,
    reasonBn: reasons.join(' '),
  };
}

@Injectable()
export class RulesFertilizerAdapter implements AiFertilizerPort {
  recommend(input: FertilizerInput): Promise<FertilizerResult> {
    return Promise.resolve(recommendFertilizer(input));
  }
}
