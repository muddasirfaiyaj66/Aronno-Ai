/**
 * Per-bigha cultivation inputs for common Bangladeshi crops, at approximate
 * 2025 retail prices (subsidised urea/TSP/MoP, ৳600/day farm labour). Used by
 * the cost estimator and the crop plan so both show the same numbers.
 */

export const BIGHA_PER_ACRE = 3;

export const COST_CROP_SLUGS = [
  'rice',
  'potato',
  'tomato',
  'vegetable',
  'onion',
  'mustard',
  'lentil',
  'corn',
] as const;

export type CostCropSlug = (typeof COST_CROP_SLUGS)[number];

type InputLine = {
  labelBn: string;
  /** Quantity per bigha, in `unitBn`. */
  perBigha: number;
  unitBn: string;
  unitPriceBdt: number;
};

const FERT = {
  urea: (kg: number): InputLine => ({
    labelBn: 'ইউরিয়া সার',
    perBigha: kg,
    unitBn: 'কেজি',
    unitPriceBdt: 27,
  }),
  tsp: (kg: number): InputLine => ({
    labelBn: 'টিএসপি সার',
    perBigha: kg,
    unitBn: 'কেজি',
    unitPriceBdt: 27,
  }),
  mop: (kg: number): InputLine => ({
    labelBn: 'এমওপি (পটাশ) সার',
    perBigha: kg,
    unitBn: 'কেজি',
    unitPriceBdt: 20,
  }),
};

const tillage = (bdt: number): InputLine => ({
  labelBn: 'জমি চাষ',
  perBigha: 1,
  unitBn: 'বার',
  unitPriceBdt: bdt,
});
const labour = (days: number): InputLine => ({
  labelBn: 'শ্রমিক মজুরি',
  perBigha: days,
  unitBn: 'দিন',
  unitPriceBdt: 600,
});
const irrigation = (times: number, bdt: number): InputLine => ({
  labelBn: 'সেচ',
  perBigha: times,
  unitBn: 'বার',
  unitPriceBdt: bdt,
});
const pesticide = (bdt: number): InputLine => ({
  labelBn: 'কীটনাশক / ছত্রাকনাশক',
  perBigha: 1,
  unitBn: 'মৌসুম',
  unitPriceBdt: bdt,
});

const CROP_INPUTS: Record<
  CostCropSlug,
  { nameBn: string; lines: InputLine[] }
> = {
  rice: {
    nameBn: 'ধান',
    lines: [
      { labelBn: 'ধানের বীজ', perBigha: 5, unitBn: 'কেজি', unitPriceBdt: 60 },
      FERT.urea(25),
      FERT.tsp(10),
      FERT.mop(10),
      tillage(1500),
      labour(8),
      irrigation(1, 1500),
      pesticide(600),
    ],
  },
  potato: {
    nameBn: 'আলু',
    lines: [
      { labelBn: 'বীজ আলু', perBigha: 150, unitBn: 'কেজি', unitPriceBdt: 45 },
      FERT.urea(35),
      FERT.tsp(30),
      FERT.mop(30),
      tillage(2000),
      labour(10),
      irrigation(3, 500),
      pesticide(1500),
    ],
  },
  tomato: {
    nameBn: 'টমেটো',
    lines: [
      { labelBn: 'চারা', perBigha: 3000, unitBn: 'টি', unitPriceBdt: 1 },
      FERT.urea(30),
      FERT.tsp(25),
      FERT.mop(20),
      tillage(1500),
      {
        labelBn: 'খুঁটি ও মাচা',
        perBigha: 1,
        unitBn: 'সেট',
        unitPriceBdt: 1500,
      },
      labour(12),
      irrigation(4, 400),
      pesticide(2000),
    ],
  },
  vegetable: {
    nameBn: 'সবজি',
    lines: [
      { labelBn: 'বীজ / চারা', perBigha: 1, unitBn: 'সেট', unitPriceBdt: 1500 },
      FERT.urea(20),
      FERT.tsp(15),
      FERT.mop(15),
      tillage(1500),
      labour(8),
      irrigation(3, 400),
      pesticide(1000),
    ],
  },
  onion: {
    nameBn: 'পেঁয়াজ',
    lines: [
      {
        labelBn: 'পেঁয়াজের বীজ',
        perBigha: 1,
        unitBn: 'কেজি',
        unitPriceBdt: 4000,
      },
      FERT.urea(25),
      FERT.tsp(20),
      FERT.mop(20),
      tillage(1500),
      labour(10),
      irrigation(4, 400),
      pesticide(1000),
    ],
  },
  mustard: {
    nameBn: 'সরিষা',
    lines: [
      { labelBn: 'সরিষার বীজ', perBigha: 1, unitBn: 'কেজি', unitPriceBdt: 150 },
      FERT.urea(12),
      FERT.tsp(10),
      FERT.mop(6),
      tillage(1200),
      labour(4),
      irrigation(1, 400),
      pesticide(300),
    ],
  },
  lentil: {
    nameBn: 'মসুর ডাল',
    lines: [
      { labelBn: 'মসুরের বীজ', perBigha: 5, unitBn: 'কেজি', unitPriceBdt: 140 },
      FERT.urea(3),
      FERT.tsp(10),
      FERT.mop(5),
      tillage(1200),
      labour(4),
      pesticide(300),
    ],
  },
  corn: {
    nameBn: 'ভুট্টা',
    lines: [
      {
        labelBn: 'ভুট্টার বীজ',
        perBigha: 3,
        unitBn: 'কেজি',
        unitPriceBdt: 400,
      },
      FERT.urea(45),
      FERT.tsp(30),
      FERT.mop(25),
      tillage(1500),
      labour(6),
      irrigation(3, 400),
      pesticide(500),
    ],
  },
};

export type CultivationCostItem = {
  labelBn: string;
  quantityBn: string;
  costBdt: number;
};

export type CultivationCost = {
  cropSlug: CostCropSlug;
  cropNameBn: string;
  landSizeBigha: number;
  items: CultivationCostItem[];
  totalBdt: number;
};

const bnNumber = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 1 });

export function isCostCropSlug(slug: string): slug is CostCropSlug {
  return (COST_CROP_SLUGS as readonly string[]).includes(slug);
}

export function toBigha(landSize: number, landUnit: 'bigha' | 'acre') {
  return landUnit === 'acre' ? landSize * BIGHA_PER_ACRE : landSize;
}

export function cultivationCost(
  cropSlug: CostCropSlug,
  landSizeBigha: number,
): CultivationCost {
  const crop = CROP_INPUTS[cropSlug];
  const items = crop.lines.map((line) => {
    const qty = line.perBigha * landSizeBigha;
    return {
      labelBn: line.labelBn,
      quantityBn: `${bnNumber.format(Math.round(qty * 10) / 10)} ${line.unitBn}`,
      costBdt: Math.round(qty * line.unitPriceBdt),
    };
  });
  return {
    cropSlug,
    cropNameBn: crop.nameBn,
    landSizeBigha,
    items,
    totalBdt: items.reduce((sum, i) => sum + i.costBdt, 0),
  };
}
